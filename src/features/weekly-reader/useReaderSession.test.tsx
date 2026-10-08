import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {AccountSessionError} from '@hallelujahhomechurch/account-client';
import {readerFixture} from './test-fixture';
import {useReaderSession} from './useReaderSession';
const store = vi.hoisted(() => ({supportsOfflineReader: () => true, watchOfflineEdition: () => () => {}, getOfflineIdentity: vi.fn(), readOfflineSave: vi.fn(), lockOfflineSave: vi.fn(), removeOfflineSave: vi.fn(), renewOfflineSave: vi.fn(), checkOfflineSave: vi.fn().mockResolvedValue('available')}));
vi.mock('./offline-store', () => store);
vi.mock('./offline-session', () => ({watchOfflineAccount: () => () => {}}));
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const api = {open: vi.fn(), renew: vi.fn()};
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(readerFixture().access.validatedAt) + 60 * 60 * 1000);
  vi.clearAllMocks(); store.getOfflineIdentity.mockResolvedValue({accountId: 'account-a', epoch: 1});
  store.lockOfflineSave.mockResolvedValue(undefined); store.removeOfflineSave.mockResolvedValue(undefined); store.renewOfflineSave.mockResolvedValue(undefined);
  store.readOfflineSave.mockResolvedValue(null);
  api.open.mockResolvedValue(readerFixture()); api.renew.mockResolvedValue(readerFixture());
});
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks();});
it('allows a stable local clock behind the server, but still locks a local rollback', async () => {
  vi.useFakeTimers();
  const local = Date.parse(readerFixture().access.validatedAt) - 30000;
  vi.setSystemTime(local);
  const {result} = renderHook(() => useReaderSession(api, selector));
  await act(async () => {});
  act(() => {expect(result.current.allowAction()).toBe(true);});
  vi.setSystemTime(local - 1);
  act(() => {expect(result.current.allowAction()).toBe(false);});
  expect(result.current.value).toBeNull();
});
it('retains a valid explicit save on member throttling without extending its receipt', async () => {
  const value = readerFixture();
  store.readOfflineSave.mockResolvedValue({save: {value, epoch: 1, lastObservedAt: Date.now()}, status: 'available'});
  api.renew.mockRejectedValue(new HhcWebApiError(429, 'rate_limited', 'Retry later'));
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.offline).toBe(true));
  expect(result.current.value).toEqual(value);
  expect(store.lockOfflineSave).not.toHaveBeenCalled();
  expect(store.renewOfflineSave).not.toHaveBeenCalled();
});
it('never extends a behind-server local deadline by accepting the same receipt again', async () => {
  vi.useFakeTimers();
  const value = readerFixture();
  const local = Date.parse(value.access.validatedAt) - 30000;
  vi.setSystemTime(local);
  const {result} = renderHook(() => useReaderSession(api, selector));
  await act(async () => {});
  vi.setSystemTime(local + 10000);
  act(() => result.current.acceptSaved(value));
  vi.setSystemTime(local + 604800000);
  act(() => {expect(result.current.allowAction()).toBe(false);});
  expect(result.current.value).toBeNull();
});
it('requests a fresh validation after an acknowledged receipt expires instead of replaying it forever', async () => {
  vi.useFakeTimers();
  const first = readerFixture();
  vi.setSystemTime(Date.parse(first.access.offlineValidUntil) - 10);
  const receipts = new Map<string, ReturnType<typeof readerFixture>>();
  api.open.mockImplementation(async (_selector, options) => {
    if (receipts.has(options.clientRequestId)) return receipts.get(options.clientRequestId);
    const next = receipts.size ? {...first, access: {...first.access, receiptId: 'fresh-receipt', validatedAt: new Date().toISOString(), offlineValidUntil: new Date(Date.now() + 604800000).toISOString()}} : first;
    receipts.set(options.clientRequestId, next);
    return next;
  });
  const {result} = renderHook(() => useReaderSession(api, selector));
  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(10));
  expect(result.current.value).toBeNull();
  await act(async () => result.current.retry());
  act(() => {expect(result.current.allowAction()).toBe(true);});
  expect(result.current.value?.access.receiptId).toBe('fresh-receipt');
});
it('locks an idle visible tab exactly at the deadline and rejects actions after a suspended clock jump', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(readerFixture().access.offlineValidUntil) - 10);
  const {result, unmount} = renderHook(() => useReaderSession(api, selector));
  await act(async () => {});
  expect(result.current.value).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(10));
  expect(result.current.value).toBeNull(); unmount();
  vi.setSystemTime(Date.parse(readerFixture().access.offlineValidUntil) - 10);
  const again = renderHook(() => useReaderSession(api, selector));
  await act(async () => {});
  vi.setSystemTime(Date.parse(readerFixture().access.offlineValidUntil) + 1);
  act(() => {expect(again.result.current.allowAction()).toBe(false);});
  expect(again.result.current.value).toBeNull();
});
it('does not turn a failed unsaved request into offline content', async () => {
  api.open.mockRejectedValue(new TypeError('network'));
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.error).toBe('unavailable'));
  expect(result.current.value).toBeNull();
});
it('validates a saved exact revision before rendering and retains its window on network failure', async () => {
  const value = readerFixture();
  store.readOfflineSave.mockResolvedValue({save: {value, epoch: 1}, status: 'available'});
  api.renew.mockRejectedValue(new TypeError('network'));
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.value).toEqual(value));
  expect(result.current.offline).toBe(true);
  expect(api.open).not.toHaveBeenCalled();
  expect(store.renewOfflineSave).not.toHaveBeenCalled();
});
it('offers login while leaving a valid same-account explicit save readable on session expiry', async () => {
  store.readOfflineSave.mockResolvedValue({save: {value: readerFixture(), epoch: 1, lastObservedAt: Date.now()}, status: 'available'});
  api.renew.mockRejectedValue(new AccountSessionError(401));
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.loginRequired).toBe(true));
  expect(result.current.value).not.toBeNull();
  expect(result.current.offline).toBe(true);
  expect(store.renewOfflineSave).not.toHaveBeenCalled();
});
it('rejects a completed validation if the account epoch changed while it was in flight', async () => {
  store.getOfflineIdentity.mockResolvedValueOnce({accountId: 'account-a', epoch: 1}).mockResolvedValue({accountId: 'account-b', epoch: 2});
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.error).toBe('unavailable'));
  expect(result.current.value).toBeNull();
});
it.each([false, true])('locks every 404 but purges only the owner unavailable marker (%s)', async marker => {
  store.readOfflineSave.mockResolvedValue({save: {value: readerFixture(), epoch: 1}, status: 'available'});
  api.renew.mockRejectedValue(new HhcWebApiError(404, 'not_found', 'Unavailable', undefined, undefined, marker));
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.error).toBe('unavailable'));
  expect(result.current.value).toBeNull();
  expect(marker ? store.removeOfflineSave : store.lockOfflineSave).toHaveBeenCalledWith(selector);
  expect(marker ? store.lockOfflineSave : store.removeOfflineSave).not.toHaveBeenCalled();
});
it('rechecks on reconnect and ignores late completions after leaving the reader', async () => {
  let finish!: (value: ReturnType<typeof readerFixture>) => void;
  api.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  const {unmount} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(api.open).toHaveBeenCalledOnce());
  unmount(); await act(async () => finish(readerFixture()));
  expect(api.open.mock.calls[0][2].aborted).toBe(true);
});
it('applies the same owner-denial boundary to private interaction failures without hiding content for transient failures', async () => {
  const {result} = renderHook(() => useReaderSession(api, selector));
  await waitFor(() => expect(result.current.value).not.toBeNull());
  act(() => result.current.privateFailure(new TypeError('network')));
  expect(result.current.value).not.toBeNull();
  await act(async () => result.current.privateFailure(new HhcWebApiError(404, 'not_found', 'Unavailable', undefined, undefined, true)));
  expect(result.current.value).toBeNull();
  expect(store.removeOfflineSave).toHaveBeenCalledWith(selector);
});
