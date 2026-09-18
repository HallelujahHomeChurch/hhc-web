import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {WeeklyArchive} from './WeeklyArchive';

const captureHandledError = vi.hoisted(() => vi.fn());
const authorization = vi.hoisted(() => ({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}));
const bulletinAccess = vi.hoisted(() => ({status: 'available', editions: ['zh-Hant']}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => null,
  useBulletinAccess: () => bulletinAccess,
  useBulletinAuthorization: () => authorization
}));
vi.mock('@/lib/observability', () => ({captureHandledError}));
vi.mock('next/navigation', () => ({useSearchParams: () => new URLSearchParams()}));

const messages = {
  eyebrow: 'Weekly Paper', archiveTitle: 'Downloads', archiveIntro: 'Available languages', latestLabel: 'Latest',
  allIssuesTitle: 'History', paginationNote: 'Newest first', paginationLabel: 'Pages', previousPage: 'Previous',
  nextPage: 'Next', pageLabel: 'Page', loading: 'Loading', loadError: 'Unavailable', retry: 'Retry', empty: 'No bulletins',
  downloading: 'Preparing download', downloadReady: 'Ready', downloadError: 'Download unavailable'
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('WeeklyArchive', () => {
  it('loads only entitled editions through protected member endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({data: [bulletin], meta: {page: 1, pageSize: 12, total: 1}, error: null}));
    vi.stubGlobal('fetch', fetcher);

    render(<WeeklyArchive locale="en" messages={messages} />);

    expect((await screen.findAllByRole('button', {name: '繁中'})).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', {name: 'English'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '繁中'})).not.toBeInTheDocument();
    expect((fetcher.mock.calls[0]?.[0] as Request).url).toContain('/api/member/bulletins?locale=zh-Hant&series=general&page=1&pageSize=12');
  });

  it('keeps an unavailable protected archive empty without rendering download controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, {status: 404})));
    render(<WeeklyArchive locale="en" messages={messages} />);

    expect(await screen.findByText('No bulletins')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '繁中'})).not.toBeInTheDocument();
  });

  it('reports a protected archive failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, {status: 403})));
    render(<WeeklyArchive locale="zh-Hant" messages={messages} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.archive', tags: {locale: 'zh-Hant', page: 1}});
  });
});

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general', locale: 'zh-Hant', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};
