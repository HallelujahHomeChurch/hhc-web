import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {WeeklyCard} from './WeeklyCard';

afterEach(() => vi.unstubAllGlobals());

describe('WeeklyCard', () => {
  it('renders the latest published bulletin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse([{
      issueNumber: 1732, issueDate: '2026-07-13', versions: [{
      issueNumber: 1732, issueDate: '2026-07-13', locale: 'en', title: 'Weekly bulletin',
      downloadUrl: '/api/assets/public/asset-1', publishedAt: '2026-07-13T04:00:00Z', version: 3
      }]
    }])));

    render(<WeeklyCard locale="en" ctaLabel="Download" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);

    expect(await screen.findByText('Weekly bulletin')).toBeInTheDocument();
    expect(screen.getByText('Issue 1732')).toBeInTheDocument();
    expect(screen.queryByText('2026-07-13')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Download'})).toHaveAttribute('href', '/api/assets/public/asset-1');
    expect(screen.getByRole('link', {name: 'Download'})).toHaveAttribute('download', '');
    expect(screen.getByRole('heading', {name: 'Weekly bulletin'})).toHaveClass('text-[18px]');
  });

  it('allows retry after a load failure', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(apiResponse(null, {code: 'unavailable', message: 'Unavailable'}, 503))
      .mockResolvedValueOnce(apiResponse([{
        issueDate: '2026-07-13', versions: [{
        issueDate: '2026-07-13', locale: 'en', title: 'Weekly bulletin',
        downloadUrl: '/weekly.pdf', publishedAt: '2026-07-13T04:00:00Z', version: 3
        }]
      }]));
    vi.stubGlobal('fetch', fetcher);
    render(<WeeklyCard locale="en" ctaLabel="Download" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    expect(await screen.findByText('Weekly bulletin')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts the active request when the card unmounts', () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>(() => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }));
    vi.stubGlobal('fetch', fetcher);

    const {unmount} = render(<WeeklyCard locale="en" ctaLabel="Download" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);
    const signal = fetcher.mock.calls[0]?.[1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

function apiResponse(data: unknown, error: unknown = null, status = 200) {
  return new Response(JSON.stringify({data, meta: {}, error}), {status});
}
