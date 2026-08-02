import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {WeeklyCard} from './WeeklyCard';

afterEach(() => vi.unstubAllGlobals());

describe('WeeklyCard', () => {
  it('renders the latest published bulletin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse([{
      issueDate: '2026-07-13', versions: [{
      issueDate: '2026-07-13', locale: 'en', title: 'Weekly bulletin',
      downloadUrl: '/api/assets/public/asset-1', publishedAt: '2026-07-13T04:00:00Z', version: 3
      }]
    }])));

    render(<WeeklyCard locale="en" ctaLabel="Download" messages={{loading: 'Loading', downloading: 'Preparing download', error: 'Unavailable', retry: 'Retry'}} />);

    expect(await screen.findByText('Weekly bulletin')).toBeInTheDocument();
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
});

function apiResponse(data: unknown, error: unknown = null, status = 200) {
  return new Response(JSON.stringify({data, meta: {}, error}), {status});
}
