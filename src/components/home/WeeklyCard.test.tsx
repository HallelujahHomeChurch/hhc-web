import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {WeeklyCard} from './WeeklyCard';

const captureHandledError = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(()=>({status:'authenticated',id:'member'}));
const access = vi.hoisted((): {status: 'available'|'loading'|'unavailable'; editions: Array<{series: 'general' | 'children'; locale: 'zh-Hant' | 'zh-Hans' | 'en'}>} => ({status: 'available', editions: [{series: 'general', locale: 'zh-Hant'}]}));
const authorization = vi.hoisted(() => ({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => auth.id,
  useAccountAuth: () => auth,
  useBulletinAccess: () => access,
  useBulletinAuthorization: () => authorization
}));
vi.mock('@/lib/observability', () => ({captureHandledError}));

const messages = {general: 'General', children: "Children's", loading: 'Loading', downloading: 'Preparing download', downloadReady: 'Ready', downloadError: 'Download unavailable', error: 'Unavailable', retry: 'Retry', readOnline:'Read online', empty:'No bulletins'};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  access.status='available';auth.status='authenticated';auth.id='member';
  access.editions = [{series: 'general', locale: 'zh-Hant'}];
});
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'));

describe('WeeklyCard', () => {
  it('uses the protected member endpoint and renders only entitled editions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(discoveryResponse([bulletin]));
    vi.stubGlobal('fetch', fetcher);

    render(<WeeklyCard locale="en" ctaLabel="Download weekly" messages={messages} />);

    expect(await screen.findByRole('button', {name: 'Download PDF: 繁中'})).toHaveTextContent('Download PDF · 繁中');
    expect(screen.queryByRole('button', {name: /English/})).not.toBeInTheDocument();
    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/member/bulletins/online?series=general&offset=0&limit=1&locales=zh-Hant');
    expect(request.headers.get('authorization')).toBe('Bearer token');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'History'})).not.toBeInTheDocument();
  });

  it('shows authorized Hans download and reading actions on a Traditional Chinese interface', async () => {
    access.editions = [{series: 'general', locale: 'zh-Hans'}];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(discoveryResponse([{...bulletin, locale: 'zh-Hans', title: '简体周报'}], true)));
    render(<WeeklyCard locale="zh-Hant" ctaLabel="下載 PDF" messages={messages} />);

    expect(await screen.findByRole('button', {name: '下載 PDF: 简中'})).toHaveTextContent('下載 PDF · 简中');
    expect(screen.getByText('简体周报')).toBeVisible();
    expect(screen.getByText('简中')).toBeVisible();
    expect(screen.getByRole('link', {name: 'Read online'})).toHaveAttribute('href', '/zh-Hant/literature-ministry/1737/read/general/zh-Hans');
    expect(screen.queryByRole('button', {name: /繁中/})).not.toBeInTheDocument();
  });

  it('allows retry after a protected request failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({}, {status: 403}))
      .mockResolvedValueOnce(discoveryResponse([bulletin])));
    render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.latest', tags: {locale: 'en', series: 'general'}});
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByRole('button', {name: 'Download PDF: 繁中'})).toBeInTheDocument();
  });

  it('aborts the protected request on unmount', async () => {
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetcher);
    const {unmount} = render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages} />);

    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const request = fetcher.mock.calls[0]?.[0] as Request;
    unmount();
    expect(request.signal.aborted).toBe(true);
  });

  it('keeps one fixed card while switching independently loaded General and Children issues', async () => {
    access.editions = [{series: 'general', locale: 'zh-Hant'}, {series: 'children', locale: 'zh-Hant'}];
    const children = {...bulletin, issueId: '00000000-0000-4000-8000-000000000002', issueNumber: 1300, series: 'children', title: '兒童週報'};
    const general = {...bulletin, issueNumber: 1301};
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async (input) => discoveryResponse([(input as Request).url.includes('series=children') ? children : general])));

    render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages} />);
    expect(await screen.findByText('Issue 1301')).toBeInTheDocument();
    const generalTab = screen.getByRole('tab', {name: 'General'});
    expect(generalTab).toHaveAttribute('aria-selected', 'true');
    generalTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByText('Issue 1300')).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: "Children's"})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', {name: "Children's"})).toHaveFocus();
    expect(document.querySelectorAll('[data-weekly-card]')).toHaveLength(1);
  });

  it('shows one matched-language Download and Online action instead of all three editions',async()=>{
    access.editions=[{series:'general',locale:'zh-Hant'},{series:'general',locale:'zh-Hans'},{series:'general',locale:'en'}];
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(discoveryResponse([bulletin,{...bulletin,locale:'zh-Hans'},{...bulletin,locale:'en'}],true)));
    render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages}/>);
    expect(await screen.findByRole('link',{name:'Read online'})).toHaveAttribute('href','/en/literature-ministry/1737/read/general/en');
    expect(screen.getAllByRole('button',{name:/Download PDF:/})).toHaveLength(1);
    expect(screen.getByRole('button',{name:'Download PDF: English'})).toBeInTheDocument();
    expect(screen.getByText('English')).toBeVisible();
    expect(screen.getByRole('link', {name: 'Read online'}).compareDocumentPosition(screen.getByRole('button', {name: 'Download PDF: English'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general', locale: 'zh-Hant', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};

function discoveryResponse(items: (typeof bulletin)[], online=false) {
  return Response.json({data:{items:items.map(item=>({issueId:item.issueId,issueDate:item.issueDate,issueNumber:item.issueNumber,series:item.series,contentLocale:item.locale,canonicalMetadata:{title:item.title,subtitle:item.subtitle,date:item.issueDate,issueNumber:item.issueNumber},pdfPublished:true,onlineRevision:online?1:null})),total:1,offset:0,limit:1},meta:{},error:null});
}

it('reserves the homepage slot while checking and removes it for an anonymous visitor',()=>{
 auth.status='checking';access.editions=[];
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const view=render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages}/>);
 expect(view.container.querySelector('[data-weekly-card] [data-loading-layout="weekly-home"]')).not.toBeNull();
 expect(fetcher).not.toHaveBeenCalled();
 auth.status='anonymous';view.rerender(<WeeklyCard locale="en" ctaLabel="Download" messages={messages}/>);
 expect(view.container.querySelector('[data-weekly-card]')).toBeNull();
});

it('ignores a rejected request from the previous account after the new account is ready',async()=>{
 let rejectOld!:(reason:Error)=>void;
 const fetcher=vi.fn<typeof fetch>().mockImplementationOnce(()=>new Promise((_resolve,reject)=>{rejectOld=reject})).mockImplementation(async()=>discoveryResponse([bulletin]));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages}/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
 auth.id='other-member';view.rerender(<WeeklyCard locale="en" ctaLabel="Download" messages={messages}/>);
 await screen.findByText('週報');
 await act(async()=>rejectOld(new Error('late old failure')));
 expect(screen.getByText('週報')).toBeInTheDocument();
 expect(view.container.querySelector('[data-loading-layout="weekly-home"]')).toBeNull();
});
