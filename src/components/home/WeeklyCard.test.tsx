import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {WeeklyCard} from './WeeklyCard';

const captureHandledError = vi.hoisted(() => vi.fn());
const access = vi.hoisted((): {status: 'available'; editions: Array<{series: 'general' | 'children'; locale: 'zh-Hant' | 'zh-Hans' | 'en'}>} => ({status: 'available', editions: [{series: 'general', locale: 'zh-Hant'}]}));
const authorization = vi.hoisted(() => ({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => null,
  useBulletinAccess: () => access,
  useBulletinAuthorization: () => authorization
}));
vi.mock('@/lib/observability', () => ({captureHandledError}));

const messages = {general: 'General', children: "Children's", loading: 'Loading', downloading: 'Preparing download', downloadReady: 'Ready', downloadError: 'Download unavailable', error: 'Unavailable', retry: 'Retry'};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  access.editions = [{series: 'general', locale: 'zh-Hant'}];
});

describe('WeeklyCard', () => {
  it('uses the protected member endpoint and renders only entitled editions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({data: bulletin, meta: {}, error: null}));
    vi.stubGlobal('fetch', fetcher);

    render(<WeeklyCard locale="en" ctaLabel="Download weekly" messages={messages} />);

    expect(await screen.findByRole('button', {name: 'Download weekly: 繁中'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /English/})).not.toBeInTheDocument();
    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/member/bulletins/latest?locale=zh-Hant&series=general');
    expect(request.headers.get('authorization')).toBe('Bearer token');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('allows retry after a protected request failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({}, {status: 503}))
      .mockResolvedValueOnce(Response.json({data: bulletin, meta: {}, error: null})));
    render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.latest', tags: {locale: 'en', series: 'general'}});
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByRole('button', {name: 'Download: 繁中'})).toBeInTheDocument();
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
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async (input) => Response.json({data: (input as Request).url.includes('series=children') ? children : general, meta: {}, error: null})));

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
});

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general', locale: 'zh-Hant', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};
