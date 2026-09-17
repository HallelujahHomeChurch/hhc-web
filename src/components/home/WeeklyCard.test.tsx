import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {WeeklyCard} from './WeeklyCard';

const captureHandledError = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => ({status: 'available' as const, editions: ['zh-Hant'] as const}));
const authorization = vi.hoisted(() => ({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => null,
  useBulletinAccess: () => access,
  useBulletinAuthorization: () => authorization
}));
vi.mock('@/lib/observability', () => ({captureHandledError}));

const messages = {loading: 'Loading', downloading: 'Preparing download', downloadReady: 'Ready', downloadError: 'Download unavailable', error: 'Unavailable', retry: 'Retry'};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

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
  });

  it('allows retry after a protected request failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({}, {status: 503}))
      .mockResolvedValueOnce(Response.json({data: bulletin, meta: {}, error: null})));
    render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.latest', tags: {locale: 'en'}});
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByRole('button', {name: 'Download: 繁中'})).toBeInTheDocument();
  });

  it('aborts the protected request on unmount', async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetcher);
    const {unmount} = render(<WeeklyCard locale="en" ctaLabel="Download" messages={messages} />);

    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const request = fetcher.mock.calls[0]?.[0] as Request;
    unmount();
    expect(request.signal.aborted).toBe(true);
  });
});

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general', locale: 'zh-Hant', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};
