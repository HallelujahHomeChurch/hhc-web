import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DownloadButton} from './DownloadButton';

const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({captureHandledError}));

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', series: 'general' as const, locale: 'zh-Hant' as const,
  issueNumber: 1737, date: '2026-09-13', title: '週報', subtitle: '', downloadName: '1737.pdf'
};

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); captureHandledError.mockClear(); localStorage.clear(); });

describe('DownloadButton', () => {
  it('downloads only the protected response and never exposes a direct file URL', async () => {
    const download = vi.fn().mockResolvedValue(new Response('pdf', {headers: {'content-disposition': "attachment; filename*=UTF-8''1737-%E9%80%B1%E5%A0%B1.pdf"}}));
    const workflow = {
      createDownloadJob: vi.fn().mockResolvedValue({id: 'job-1', operationProgress: {status: 'ready', stage: 'ready', percent: 100, updatedAt: '2026-09-21T00:00:00Z', retryAfterMs: 1_000}}),
      getDownloadJob: vi.fn(),
      downloadPreparedBulletin: download
    };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DownloadButton bulletin={bulletin} workflow={workflow} label="下載週報" />);

    fireEvent.click(screen.getByRole('button', {name: '下載週報'}));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(workflow.createDownloadJob).toHaveBeenCalledWith(bulletin, expect.any(String), expect.any(AbortSignal));
    expect(download).toHaveBeenCalledWith(bulletin, 'job-1', expect.any(AbortSignal));
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0]).toHaveProperty('href', 'blob:weekly');
    expect(click.mock.instances[0]).toHaveProperty('download', '1737-週報.pdf');
  });

  it('keeps a failed protected download recoverable', async () => {
    const workflow = {createDownloadJob: vi.fn().mockRejectedValue(new Error('unavailable')), getDownloadJob: vi.fn(), downloadPreparedBulletin: vi.fn()};
    render(<DownloadButton bulletin={bulletin} workflow={workflow} label="下載週報" errorLabel="暫時無法下載" />);

    fireEvent.click(screen.getByRole('button', {name: '下載週報'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('暫時無法下載');
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'weekly.download'});
  });

  it('resumes a persisted job without creating a duplicate', async () => {
    localStorage.setItem(`weekly-download-job:anonymous:${bulletin.issueId}:${bulletin.locale}`, JSON.stringify({idempotencyKey: 'attempt-1', jobId: 'job-1'}));
    const download = vi.fn().mockResolvedValue(new Response('pdf'));
    const workflow = {
      createDownloadJob: vi.fn(),
      getDownloadJob: vi.fn().mockResolvedValue({id: 'job-1', operationProgress: {status: 'ready', stage: 'ready', percent: 100, updatedAt: '2026-09-21T00:00:00Z', retryAfterMs: 1_000}}),
      downloadPreparedBulletin: download
    };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<DownloadButton bulletin={bulletin} workflow={workflow} label="下載週報" />);

    await waitFor(() => expect(download).toHaveBeenCalledWith(bulletin, 'job-1', expect.any(AbortSignal)));
    expect(workflow.createDownloadJob).not.toHaveBeenCalled();
    expect(localStorage.getItem(`weekly-download-job:anonymous:${bulletin.issueId}:${bulletin.locale}`)).toBeNull();
  });

  it('keeps the same progress copy when resuming a running job', async () => {
    localStorage.setItem(`weekly-download-job:anonymous:${bulletin.issueId}:${bulletin.locale}`, JSON.stringify({idempotencyKey: 'attempt-1', jobId: 'job-1'}));
    const workflow = {
      createDownloadJob: vi.fn(),
      getDownloadJob: vi.fn().mockResolvedValue({id: 'job-1', operationProgress: {status: 'running', stage: 'watermarking', percent: 65, updatedAt: '2026-09-21T00:00:00Z', retryAfterMs: 10_000}}),
      downloadPreparedBulletin: vi.fn()
    };

    render(<DownloadButton bulletin={bulletin} workflow={workflow} label="下載週報" preparingLabel="正在準備下載週報 {progress} %。" />);

    expect(await screen.findByRole('progressbar', {name: '正在準備下載週報 65 %。'})).toHaveAttribute('aria-valuenow', '65');
    expect(workflow.createDownloadJob).not.toHaveBeenCalled();
  });

  it('polls with the server delay and reports determinate progress', async () => {
    vi.useFakeTimers();
    const workflow = {
      createDownloadJob: vi.fn().mockResolvedValue({id: 'job-1', operationProgress: {status: 'running', stage: 'watermarking', percent: 40, updatedAt: '2026-09-21T00:00:00Z', retryAfterMs: 10}}),
      getDownloadJob: vi.fn().mockResolvedValue({id: 'job-1', operationProgress: {status: 'ready', stage: 'ready', percent: 100, updatedAt: '2026-09-21T00:00:01Z', retryAfterMs: 1_000}}),
      downloadPreparedBulletin: vi.fn().mockResolvedValue(new Response('pdf'))
    };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DownloadButton bulletin={bulletin} workflow={workflow} label="下載週報" preparingLabel="正在準備下載週報 {progress} %。" />);

    fireEvent.click(screen.getByRole('button', {name: '下載週報'}));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('progressbar', {name: '正在準備下載週報 40 %。'})).toHaveAttribute('aria-valuenow', '40');
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(workflow.getDownloadJob).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(workflow.getDownloadJob).toHaveBeenCalledWith(bulletin, 'job-1', expect.any(AbortSignal));
    expect(workflow.downloadPreparedBulletin).toHaveBeenCalledWith(bulletin, 'job-1', expect.any(AbortSignal));
  });

  it.each([0, 5, 65, 100])('formats %i percent with the localized percent sign', async (percent) => {
    const workflow = {
      createDownloadJob: vi.fn().mockResolvedValue({id: 'job-1', operationProgress: {status: 'running', stage: 'watermarking', percent, updatedAt: '2026-09-21T00:00:00Z', retryAfterMs: 10_000}}),
      getDownloadJob: vi.fn(),
      downloadPreparedBulletin: vi.fn()
    };
    render(<DownloadButton bulletin={bulletin} workflow={workflow} label="下載週報" preparingLabel="正在準備下載週報 {progress} %。" />);

    fireEvent.click(screen.getByRole('button', {name: '下載週報'}));

    expect(await screen.findByRole('progressbar', {name: `正在準備下載週報 ${percent} %。`})).toHaveAttribute('aria-valuenow', String(percent));
  });
});
