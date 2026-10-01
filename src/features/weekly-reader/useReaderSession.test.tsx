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
  vi.clearAllMocks(); store.getOfflineIdentity.mockResolvedValue({accountId: 'account-a', epoch: 1});
  store.lockOfflineSave.mockResolvedValue(undefined); store.removeOfflineSave.mockResolvedValue(undefined); store.renewOfflineSave.mockResolvedValue(undefined);
  store.readOfflineSave.mockResolvedValue(null);
  api.open.mockResolvedValue(readerFixture()); api.renew.mockResolvedValue(readerFixture());
});
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks();});
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
