import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DownloadButton} from './DownloadButton';

const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({captureHandledError}));

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', series: 'general', locale: 'zh-Hant' as const,
  issueNumber: 1737, date: '2026-09-13', title: '週報', subtitle: '', downloadName: '1737.pdf'
};

afterEach(() => { vi.restoreAllMocks(); captureHandledError.mockClear(); });

describe('DownloadButton', () => {
  it('downloads only the protected response and never exposes a direct file URL', async () => {
    const download = vi.fn().mockResolvedValue(new Response('pdf', {headers: {'content-disposition': "attachment; filename*=UTF-8''1737-%E9%80%B1%E5%A0%B1.pdf"}}));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DownloadButton bulletin={bulletin} download={download} label="下載週報" />);

    fireEvent.click(screen.getByRole('button', {name: '下載週報'}));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(download).toHaveBeenCalledWith(bulletin, expect.any(AbortSignal));
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0]).toHaveProperty('href', 'blob:weekly');
    expect(click.mock.instances[0]).toHaveProperty('download', '1737-週報.pdf');
  });

  it('keeps a failed protected download recoverable', async () => {
    render(<DownloadButton bulletin={bulletin} download={vi.fn().mockRejectedValue(new Error('unavailable'))} label="下載週報" errorLabel="暫時無法下載" />);

    fireEvent.click(screen.getByRole('button', {name: '下載週報'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('暫時無法下載');
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.download'});
  });
});
