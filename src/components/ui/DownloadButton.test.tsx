import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

const issueAccessToken = vi.hoisted(() => vi.fn().mockResolvedValue({accessToken: 'member-token', expiresIn: 900}));
vi.mock('@/lib/browser-bootstrap', () => ({getSharedAccountSessionClient: () => ({issueAccessToken})}));
import {DownloadButton} from './DownloadButton';

afterEach(() => vi.restoreAllMocks());

describe('DownloadButton', () => {
  it('keeps its label and dimensions while preventing duplicate downloads', () => {
    render(<DownloadButton href="/assets/weekly.pdf" label="下載週報" />);

    const link = screen.getByRole('link', {name: '下載週報'});
    expect(link).toHaveAttribute('download', '');

    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('href', '/assets/weekly.pdf');
    expect(link.querySelector('[data-download-spinner]')).toBeInTheDocument();
    expect(fireEvent.click(link)).toBe(false);
  });

  it('downloads member files with a session access token', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('pdf', {
      headers: {'content-disposition': "attachment; filename*=UTF-8''weekly.pdf"}
    }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated />);

    fireEvent.click(screen.getByRole('link', {name: '會員週報'}));

    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/member/bulletin-downloads/2026-09-13', expect.objectContaining({
      headers: {Authorization: 'Bearer member-token'}, cache: 'no-store'
    })));
    expect(click).toHaveBeenCalled();
  });
});
