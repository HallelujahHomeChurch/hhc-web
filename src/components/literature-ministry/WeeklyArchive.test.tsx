import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {WeeklyArchive} from './WeeklyArchive';

const captureHandledError = vi.hoisted(() => vi.fn());
const authorization = vi.hoisted(() => ({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}));
const bulletinAccess = vi.hoisted((): {status: 'available'; editions: Array<{series: 'general' | 'children'; locale: 'zh-Hant' | 'zh-Hans' | 'en'}>} => ({status: 'available', editions: [{series: 'general', locale: 'zh-Hant'}]}));
const search = vi.hoisted(() => ({value: ''}));
const replace = vi.hoisted(() => vi.fn());
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => null,
  useBulletinAccess: () => bulletinAccess,
  useBulletinAuthorization: () => authorization
}));
vi.mock('@/lib/observability', () => ({captureHandledError}));
vi.mock('next/navigation', () => ({useSearchParams: () => new URLSearchParams(search.value), useRouter: () => ({replace})}));

const messages = {
  eyebrow: 'Weekly Paper', archiveTitle: 'Downloads', archiveIntro: 'Available languages', latestLabel: 'Latest',
  general: 'General bulletin', children: "Children's bulletin",
  allIssuesTitle: 'History', paginationNote: 'Newest first', paginationLabel: 'Pages', previousPage: 'Previous',
  nextPage: 'Next', pageLabel: 'Page', loading: 'Loading', loadError: 'Unavailable', retry: 'Retry', empty: 'No bulletins',
  downloading: 'Preparing download', downloadReady: 'Ready', downloadError: 'Download unavailable', readOnline:'Read online'
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  search.value = '';
  bulletinAccess.editions = [{series: 'general', locale: 'zh-Hant'}];
});
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'));

describe('WeeklyArchive', () => {
  it('separates online reading from PDF actions without hiding authorized languages', async () => {
    bulletinAccess.editions = [{series: 'general', locale: 'zh-Hant'}, {series: 'general', locale: 'en'}];
    vi.stubGlobal('fetch', vi.fn(async () => {
      const payload = await discoveryResponse(bulletin).json();
      payload.data.items.push(
        {...payload.data.items[0], contentLocale: 'en', canonicalMetadata: {...payload.data.items[0].canonicalMetadata, title: 'English bulletin'}, onlineRevision: 1},
        {...payload.data.items[0], contentLocale: 'zh-Hans', onlineRevision: 1}
      );
      return Response.json(payload);
    }));
    const view = render(<WeeklyArchive locale="en" messages={messages}/>);
    expect(await screen.findAllByRole('link', {name: 'Read online: English'})).toHaveLength(2);
    expect(screen.queryByRole('button', {name: /Download PDF:/})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', {name: 'Download PDF'}));
    expect(replace).toHaveBeenCalledWith('/en/literature-ministry?series=general&mode=pdf', {scroll: false});
    search.value = 'series=general&mode=pdf';
    view.rerender(<WeeklyArchive locale="en" messages={messages}/>);
    expect(screen.getByRole('tab', {name: 'Download PDF'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('link', {name: /Read online:/})).not.toBeInTheDocument();
    for (const label of ['English', '繁中']) {
      const buttons = screen.getAllByRole('button', {name: `Download PDF: ${label}`});
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button).toBeVisible();
        expect(button).toHaveTextContent(label);
      }
    }
    expect(screen.queryByText('Other languages', {selector: 'summary'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Download PDF: 简中'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Read online: 简中'})).not.toBeInTheDocument();
  });
  it('loads only entitled editions through protected member endpoints', async () => {
    search.value = 'mode=pdf';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => discoveryResponse(bulletin));
    vi.stubGlobal('fetch', fetcher);

    render(<WeeklyArchive locale="en" messages={messages} />);

    expect((await screen.findAllByRole('button', {name: 'Download PDF: 繁中'})).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', {name: 'English'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '繁中'})).not.toBeInTheDocument();
    expect(fetcher.mock.calls.map(([input]) => (input as Request).url)).toContainEqual(expect.stringContaining('/api/member/bulletins/online?series=general&offset=0&limit=12&locales=zh-Hant'));
  });

  it('keeps an unavailable protected archive empty without rendering download controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({}, {status: 404})));
    render(<WeeklyArchive locale="en" messages={messages} />);

    expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', {name: '繁中'})).not.toBeInTheDocument();
  });

  it('reports a protected archive failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, {status: 403})));
    render(<WeeklyArchive locale="zh-Hant" messages={messages} />);

    expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThan(0);
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.archive', tags: {locale: 'zh-Hant', page: 1, series: 'general'}});
  });

  it('restores the selected series from the URL and keeps latest independent from history pages', async () => {
    bulletinAccess.editions = [{series: 'general', locale: 'zh-Hant'}, {series: 'children', locale: 'zh-Hant'}];
    search.value = 'series=children&page=2&mode=pdf';
    const children = {...bulletin, issueId: '00000000-0000-4000-8000-000000000002', issueNumber: 1300, series: 'children', title: '兒童週報'};
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => discoveryResponse(children,36));
    vi.stubGlobal('fetch', fetcher);

    const view = render(<WeeklyArchive locale="en" messages={messages} />);
    expect((await screen.findAllByText('Issue 1300')).length).toBeGreaterThan(0);
    expect(fetcher.mock.calls.map(([input]) => (input as Request).url)).toEqual(expect.arrayContaining([
      expect.stringContaining('series=children&offset=0&limit=1&locales=zh-Hant'),
      expect.stringContaining('series=children&offset=12&limit=12&locales=zh-Hant')
    ]));
    expect(screen.getByRole('link', {name: 'General bulletin'})).toHaveAttribute('href', '/en/literature-ministry?series=general&mode=pdf');
    expect(screen.getByRole('link', {name: 'Next'})).toHaveAttribute('href', '/en/literature-ministry?series=children&page=3&mode=pdf');

    search.value = 'series=children&page=3&mode=pdf';
    view.rerender(<WeeklyArchive locale="en" messages={messages} />);
    await waitFor(() => expect(fetcher.mock.calls.some(([input]) => (input as Request).url.includes('series=children&offset=24&limit=12&locales=zh-Hant'))).toBe(true));
    expect(fetcher.mock.calls.filter(([input]) => new URL((input as Request).url).searchParams.get('limit')==='1')).toHaveLength(1);
    expect(screen.getAllByText('Issue 1300').length).toBeGreaterThan(0);
  });

  it('keeps Online-only readable without a Download button',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>discoveryResponse(bulletin,1,false)));
    render(<WeeklyArchive locale="en" messages={messages}/>);
    expect((await screen.findAllByRole('link',{name:'Read online: 繁中'})).length).toBe(2);
    expect(screen.queryByRole('button',{name:'繁中'})).not.toBeInTheDocument();
  });

  it('keeps PDF-only history reachable while showing its unpublished online state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => discoveryResponse(bulletin)));
    const view = render(<WeeklyArchive locale="en" messages={messages}/>);
    expect(await screen.findAllByText('Online reading is not available for this issue.')).toHaveLength(2);
    expect(screen.queryByRole('link', {name: /Read online:/})).not.toBeInTheDocument();
    search.value = 'mode=pdf';
    view.rerender(<WeeklyArchive locale="en" messages={messages}/>);
    expect(screen.getAllByRole('button', {name: 'Download PDF: 繁中'})).toHaveLength(2);
  });

  it('does not invent PDF actions for an online-only issue in PDF mode', async () => {
    search.value = 'mode=pdf';
    vi.stubGlobal('fetch', vi.fn(async () => discoveryResponse(bulletin, 1, false)));
    render(<WeeklyArchive locale="en" messages={messages}/>);
    expect(await screen.findAllByText('PDF download is not available for this issue.')).toHaveLength(2);
    expect(screen.queryByRole('button', {name: /Download PDF:/})).not.toBeInTheDocument();
  });

  it('keeps the PDF entry available when online reading is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn(async () => discoveryResponse(bulletin)));
    render(<WeeklyArchive locale="en" messages={messages}/>);
    expect(await screen.findAllByRole('button', {name: 'Download PDF: 繁中'})).toHaveLength(2);
    expect(screen.queryByRole('tab', {name: 'Read online'})).not.toBeInTheDocument();
  });

  it('keeps a Hans-only grant readable on a Traditional Chinese interface', async () => {
    bulletinAccess.editions = [{series: 'general', locale: 'zh-Hans'}];
    vi.stubGlobal('fetch', vi.fn(async () => discoveryResponse({...bulletin, locale: 'zh-Hans'}, 1, false)));
    render(<WeeklyArchive locale="zh-Hant" messages={messages}/>);
    expect(await screen.findAllByRole('link', {name: 'Read online: 简中'})).toHaveLength(2);
    expect(screen.getAllByRole('link', {name: 'Read online: 简中'})[0]).toHaveAttribute('href', '/zh-Hant/literature-ministry/1737/read/general/zh-Hans');
    expect(screen.queryByRole('link', {name: 'Read online: 繁中'})).not.toBeInTheDocument();
  });
});

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general', locale: 'zh-Hant', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};

function discoveryResponse(item: typeof bulletin,total=1,pdfPublished=true) {
  return Response.json({data:{items:[{issueId:item.issueId,issueDate:item.issueDate,issueNumber:item.issueNumber,series:item.series,contentLocale:item.locale,canonicalMetadata:{title:item.title,subtitle:item.subtitle,date:item.issueDate,issueNumber:item.issueNumber},pdfPublished,onlineRevision:pdfPublished?null:2}],total,offset:0,limit:12},meta:{},error:null});
}
