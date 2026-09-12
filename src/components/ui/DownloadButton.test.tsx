import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

const issueAccessToken = vi.hoisted(() => vi.fn().mockResolvedValue({accessToken: 'member-token', expiresIn: 900}));
vi.mock('@/lib/browser-bootstrap', () => ({getSharedAccountSessionClient: () => ({issueAccessToken})}));
import {DownloadButton} from './DownloadButton';
import * as AccountControl from '@/components/layout/AccountControl';

afterEach(() => {vi.restoreAllMocks(); issueAccessToken.mockClear(); vi.useRealTimers();});

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
    const id = '00000000-0000-4000-8000-000000000001';
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({data: {id, status: 'ready', createdAt: '2026-09-13T00:00:00Z', expiresAt: '2027-09-13T00:00:00Z'}}))
      .mockResolvedValueOnce(new Response('pdf', {headers: {'content-disposition': "attachment; filename*=UTF-8''1737-%E8%A9%A9%E7%AF%87.pdf"}}));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated />);

    fireEvent.click(screen.getByRole('link', {name: '會員週報'}));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/member/bulletin-download-jobs', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({Authorization: 'Bearer member-token'}), cache: 'no-store'
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, `/api/member/bulletin-download-jobs/${id}/file`, expect.objectContaining({headers: {Authorization: 'Bearer member-token'}}));
    expect(click).toHaveBeenCalled();
    expect(click.mock.instances[0]).toHaveProperty('download', '1737-詩篇.pdf');
    expect(issueAccessToken).toHaveBeenCalledTimes(1);
  });

  it('polls an accepted preparation before downloading', async () => {
    vi.useFakeTimers();
    const id = '00000000-0000-4000-8000-000000000002';
    const pending = () => new Response(JSON.stringify({data: {id, status: 'queued', createdAt: '2026-09-13T00:00:00Z', expiresAt: '2027-09-13T00:00:00Z'}}), {status: 202, headers: {'Content-Type': 'application/json', 'Retry-After': '1'}});
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(pending())
      .mockResolvedValueOnce(Response.json({data: {id, status: 'ready', createdAt: '2026-09-13T00:00:00Z', expiresAt: '2027-09-13T00:00:00Z'}}))
      .mockResolvedValueOnce(new Response('pdf'));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:weekly');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13?locale=zh-Hant" label="會員週報" authenticated />);

    fireEvent.click(screen.getByRole('link', {name: '會員週報'}));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(2, `/api/member/bulletin-download-jobs/${id}`, expect.anything());
    expect(fetcher).toHaveBeenNthCalledWith(3, `/api/member/bulletin-download-jobs/${id}/file`, expect.anything());
    expect(issueAccessToken).toHaveBeenCalledTimes(1);
  });

  it('shows one preparation toast while an authenticated download is pending', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

    const link = screen.getByRole('link', {name: '會員週報'});
    fireEvent.click(link);

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('正在準備週報，完成後會自動下載。');
    expect(toast.parentElement).toHaveClass('hhc-toast-region');
    expect(link).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(link);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it('shows a danger toast when an authenticated download fails', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', {status: 503}));
  render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated errorLabel="週報暫時無法下載，請稍後再試。" />);

  fireEvent.click(screen.getByRole('link', {name: '會員週報'}));

  expect(await screen.findByRole('alert')).toHaveClass('hhc-toast', 'hhc-toast--danger');
  expect(screen.getByRole('alert')).toHaveTextContent('週報暫時無法下載，請稍後再試。');
});

function pendingMemberDownload() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
}

async function startPendingMemberDownload() {
  const link = screen.getByRole('link', {name: '會員週報'});
  fireEvent.click(link);
  expect(await screen.findByRole('status')).toHaveTextContent('正在準備週報，完成後會自動下載。');
}

it('removes the preparation toast without an error when account signs out', async () => {
  const fetcher = pendingMemberDownload();
  render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

  await startPendingMemberDownload();
  window.dispatchEvent(new CustomEvent('hhc:account-state', {detail: {type: 'sign-out'}}));

  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('removes the preparation toast without an error when the account changes', async () => {
  const fetcher = pendingMemberDownload();
  const identity = vi.spyOn(AccountControl, 'useAccountIdentity').mockReturnValue('member-A');
  const {rerender} = render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

  await startPendingMemberDownload();
  identity.mockReturnValue('member-B');
  rerender(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('removes the preparation toast without an error when the download href changes', async () => {
  const fetcher = pendingMemberDownload();
  const {rerender} = render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

  await startPendingMemberDownload();
  rerender(<DownloadButton href="/api/member/bulletin-downloads/2026-09-20" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('aborts an in-flight download when its component unmounts', async () => {
  const fetcher = pendingMemberDownload();
  const {unmount} = render(<DownloadButton href="/api/member/bulletin-downloads/2026-09-13" label="會員週報" authenticated preparingLabel="正在準備週報，完成後會自動下載。" />);

  await startPendingMemberDownload();
  unmount();

  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
});

it('releases a public download button when the account identity changes', () => {
  const identity = vi.spyOn(AccountControl, 'useAccountIdentity').mockReturnValue(null);
  const {rerender} = render(<DownloadButton href="/assets/weekly.pdf" label="Download" />);
  const link = screen.getByRole('link', {name: 'Download'});
  link.addEventListener('click', event => event.preventDefault());
  fireEvent.click(link);
  expect(link).toHaveAttribute('aria-busy', 'true');
  identity.mockReturnValue('member-B');
  rerender(<DownloadButton href="/assets/weekly.pdf" label="Download" />);
  expect(link).toHaveAttribute('aria-busy', 'false');
  expect(link).toHaveAttribute('aria-disabled', 'false');
  fireEvent.click(link);
  expect(link).toHaveAttribute('aria-busy', 'true');
});
