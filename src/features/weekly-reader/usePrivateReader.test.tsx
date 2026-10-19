import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {HhcWebApiError, type BulletinReaderMutation, type BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {usePrivateReader} from './usePrivateReader';
import {readReaderReturn, saveReaderReturn} from './return-state';

const localStore = vi.hoisted(() => ({supported: vi.fn(() => false), read: vi.fn(), replica: vi.fn()}));
vi.mock('./offline-store', async original => ({...await original<typeof import('./offline-store')>(), supportsOfflineReader: localStore.supported, readOfflineSave: localStore.read, readPrivateReplica: localStore.replica}));
const value = readerFixture();
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const state: BulletinReaderState = {accountId: 'account-a', documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const mutation: BulletinReaderMutation = {mutationId: 'id', documentRevision: 1, createdAt: '2026-10-02T00:00:00Z', kind: 'setHighlight', payload: {sentenceIds: ['s0'], color: 'yellow'}};
const api = {privateState: vi.fn(), mutate: vi.fn(), renew: vi.fn()};
const onFailure = vi.fn();
beforeEach(() => {vi.resetAllMocks(); localStore.supported.mockReturnValue(false); sessionStorage.clear(); api.privateState.mockResolvedValue({state});});
it.each(['network', 'reader_request_timeout'])('shows highlights optimistically, rolls back %s writes, and reuses the original mutation for retry', async failure => {
  let reject!: (error: unknown) => void;
  api.mutate.mockImplementationOnce(() => new Promise((_resolve, fail) => {reject = fail;}));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  let request!: Promise<unknown>;
  act(() => {request = result.current.mutate(mutation);});
  await waitFor(() => expect(result.current.state?.highlights[0].color).toBe('yellow'));
  await act(async () => {reject(new TypeError(failure)); await request.catch(() => {});});
  expect(result.current.state?.highlights).toEqual([]);
  api.mutate.mockResolvedValue({state, results: [{mutationId: 'id', status: 'applied', revision: 1}]});
  await act(async () => {await result.current.mutate({...mutation, mutationId: 'new-attempt'});});
  expect(api.mutate.mock.calls[1][2][0].mutationId).toBe('id');
});
it('does not display stale-account state after unmount and delegates owner denial to the common reader boundary', async () => {
  api.privateState.mockRejectedValue(new HhcWebApiError(404, 'not_found', 'Unavailable', undefined, undefined, true));
  const {result, unmount} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.status).toBe('action'));
  expect(result.current.state).toBeNull(); expect(onFailure).toHaveBeenCalledOnce();
  unmount(); expect(api.privateState.mock.calls[0][2].aborted).toBe(true);
});
it('does not bind a newer private state to the pinned renderer or send writes after authorization expires', async () => {
  api.privateState.mockResolvedValue({state: {...state, currentRevision: 2, appliedRevision: 2}});
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => false, onFailure}));
  await waitFor(() => expect(result.current.status).toBe('paused'));
  expect(result.current.state).toBeNull();
  await expect(result.current.mutate(mutation)).rejects.toThrow();
  expect(api.mutate).not.toHaveBeenCalled();
});
it('offers an explicit same-ID retry after a lost progress acknowledgement and releases busy state across refresh', async () => {
  const progress: BulletinReaderMutation = {...mutation, kind: 'setProgress', payload: {pageId: 'p1'}};
  api.mutate.mockRejectedValueOnce(new TypeError('network'));
  const {result, rerender} = renderHook(({current}) => usePrivateReader({api, selector, value: current, offline: false, allowAction: () => true, onFailure}), {initialProps: {current: value}});
  await waitFor(() => expect(result.current.state).toEqual(state));
  await act(async () => {await result.current.mutate(progress).catch(() => {});});
  expect(result.current.canRetry).toBe(true);
  api.mutate.mockResolvedValueOnce({state, results: [{mutationId: progress.mutationId, status: 'applied', revision: 1}]});
  await act(async () => {await result.current.retry();});
  expect(api.mutate.mock.calls[1][2][0]).toEqual(progress);
  expect(result.current.canRetry).toBe(false);
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});}));
  let request!: Promise<unknown>;
  act(() => {request = result.current.mutate(mutation);});
  await waitFor(() => expect(result.current.busy).toBe(true));
  rerender({current: structuredClone(value)});
  await act(async () => {finish(); await request.catch(() => {});});
  expect(result.current.busy).toBe(false);
});

it('requires explicit retry after same-account login and keeps an unknown acknowledgement across remount', async () => {
  const binding = {accountId: selector.accountId, documentId: value.document.documentId};
  saveReaderReturn(binding, {revision: 1, action: mutation});
  const {result, unmount} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  expect(result.current.canRetry).toBe(true);
  expect(api.mutate).not.toHaveBeenCalled();
  api.mutate.mockRejectedValueOnce(new TypeError('lost ack'));
  await act(async () => {await result.current.retry().catch(() => {});});
  expect(readReaderReturn(binding)?.action).toEqual(mutation);
  unmount();
  api.mutate.mockResolvedValueOnce({state, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});
  const again = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(again.result.current.state).toEqual(state));
  expect(api.mutate).toHaveBeenCalledTimes(1);
  await act(async () => {await again.result.current.retry();});
  expect(api.mutate.mock.calls[1][2][0]).toEqual(mutation);
  expect(readReaderReturn(binding)?.action).toBeNull();
});

it('retains the original action when its acknowledged revision changed', async () => {
  api.mutate.mockResolvedValue({state: {...state, currentRevision: 2, appliedRevision: 2}, results: [{mutationId: mutation.mutationId, status: 'revision_changed', revision: 2}]});
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  await act(async () => {await result.current.mutate(mutation);});
  expect(result.current.pendingMutation).toEqual(mutation);
  expect(readReaderReturn({accountId: selector.accountId, documentId: value.document.documentId})?.action).toEqual(mutation);
});

it('accepts the first foreground write while background progress is in flight', async () => {
  const progress: BulletinReaderMutation = {...mutation, mutationId: 'progress-a', kind: 'setProgress', payload: {pageId: 'p1'}};
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: progress.mutationId, status: 'applied', revision: 1}]});}));
  api.mutate.mockImplementation(async (_selector, _value, writes) => ({state, results: writes.map((write: BulletinReaderMutation) => ({mutationId: write.mutationId, status: 'applied', revision: 1}))}));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  let background!: Promise<unknown>, foreground!: Promise<unknown>;
  act(() => {background = result.current.mutate(progress);});
  await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  act(() => {foreground = result.current.mutate(mutation).catch(error => error);});
  expect(api.mutate).toHaveBeenCalledOnce();
  await act(async () => {finish(); await background; await foreground;});
  expect(api.mutate).toHaveBeenCalledTimes(2);
  expect(api.mutate.mock.calls[1][2]).toEqual([mutation]);
  expect(await foreground).toMatchObject({status: 'applied'});
});

it('continues an accepted foreground intent once after explicitly confirming lost progress', async () => {
  const progress: BulletinReaderMutation = {...mutation, mutationId: 'progress-lost', kind: 'setProgress', payload: {pageId: 'p1'}};
  api.mutate.mockRejectedValueOnce(new TypeError('lost acknowledgement'));
  api.mutate.mockImplementation(async (_selector, _value, writes) => ({state, results: writes.map((write: BulletinReaderMutation) => ({mutationId: write.mutationId, status: 'applied', revision: 1}))}));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  await act(async () => {await result.current.mutate(progress).catch(() => {});});
  let foreground!: Promise<unknown>;
  act(() => {foreground = result.current.mutate(mutation).catch(error => error);});
  expect(api.mutate).toHaveBeenCalledOnce();
  await act(async () => {await result.current.retry(); await foreground;});
  expect(api.mutate).toHaveBeenCalledTimes(3);
  expect(api.mutate.mock.calls[1][2][0]).toEqual(progress);
  expect(api.mutate.mock.calls[2][2][0]).toEqual(mutation);
  expect(await foreground).toMatchObject({mutationId: mutation.mutationId, status: 'applied'});
});

it('uses the latest confirmed state when a captured callback runs again before rerender', async () => {
  const confirmed = {...state, progress: {pageId: 'p1', componentId: 'c1', sentenceId: 's1', recordedAt: '', updatedAt: ''}};
  api.mutate.mockResolvedValueOnce({state: confirmed, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]}).mockRejectedValueOnce(new TypeError('network'));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  const captured = result.current.mutate;
  await act(async () => {
    await captured(mutation);
    await captured({...mutation, mutationId: 'second', payload: {sentenceIds: ['s1'], color: 'blue'}}).catch(() => {});
  });
  expect(result.current.state?.progress).toEqual(confirmed.progress);
});

it('coalesces only unsent progress and gives the accepted foreground intent priority', async () => {
  const progress = (id: string): BulletinReaderMutation => ({...mutation, mutationId: id, kind: 'setProgress', payload: {pageId: 'p1'}});
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: 'first', status: 'applied', revision: 1}]});}));
  api.mutate.mockImplementation(async (_selector, _value, writes) => ({state, results: writes.map((write: BulletinReaderMutation) => ({mutationId: write.mutationId, status: 'applied', revision: 1}))}));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  let first!: Promise<unknown>, user!: Promise<unknown>;
  act(() => {first = result.current.mutate(progress('first'));});
  await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  act(() => {user = result.current.mutate(mutation);});
  await act(async () => {
    expect(await result.current.mutate(progress('older'))).toEqual({status: 'deferred'});
    expect(await result.current.mutate(progress('latest'))).toEqual({status: 'deferred'});
    finish(); await first; await user;
  });
  await waitFor(() => expect(api.mutate).toHaveBeenCalledTimes(3));
  expect(api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual(['first', mutation.mutationId, 'latest']);
});

it('does not release the transport lock or continue a timed out foreground intent on late acknowledgement', async () => {
  const progress: BulletinReaderMutation = {...mutation, mutationId: 'slow', kind: 'setProgress', payload: {pageId: 'p1'}};
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: 'slow', status: 'applied', revision: 1}]});}));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
  try {
    let first!: Promise<unknown>, user!: Promise<unknown>;
    await act(async () => {first = result.current.mutate(progress).catch(error => error);});
    await act(async () => {user = result.current.mutate(mutation).catch(error => error);});
    await act(async () => {await vi.advanceTimersByTimeAsync(20000);});
    expect(await first).toMatchObject({reason: 'timeout'});
    expect(await user).toMatchObject({reason: 'timeout'});
    expect(result.current.busy).toBe(true);
    await expect(result.current.retry()).rejects.toMatchObject({reason: 'busy'});
    await act(async () => {finish();});
    expect(result.current.busy).toBe(false);
    expect(api.mutate).toHaveBeenCalledOnce();
    expect(result.current.pendingMutation).toEqual(progress);
  } finally {vi.useRealTimers();}
});

it('serializes recovery writes with foreground and progress and preserves their confirmed base', async () => {
  const recovered = {...state, progress: {pageId: 'p2', componentId: 'c2', sentenceId: 's2', recordedAt: '', updatedAt: ''}};
  let finish!: () => void;
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  let recovery!: Promise<unknown>, user!: Promise<unknown>;
  act(() => {recovery = result.current.runExclusive(async signal => {await new Promise<void>(resolve => {finish = resolve;}); signal.throwIfAborted(); result.current.acceptState(recovered);});});
  await waitFor(() => expect(result.current.busy).toBe(true));
  api.mutate.mockRejectedValueOnce(new TypeError('later write failed'));
  act(() => {user = result.current.mutate(mutation).catch(error => error);});
  expect(api.mutate).not.toHaveBeenCalled();
  await act(async () => {finish(); await recovery; await user;});
  expect(result.current.state?.progress).toEqual(recovered.progress);
  expect(api.mutate).toHaveBeenCalledOnce();
});

it('does not let a delayed reload fallback overwrite a newer acknowledged write', async () => {
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.state).toEqual(state));
  localStore.supported.mockReturnValue(true); localStore.read.mockResolvedValue(null);
  let fallback!: (value: unknown) => void;
  localStore.replica.mockImplementationOnce(() => new Promise(resolve => {fallback = resolve;}));
  api.privateState.mockRejectedValueOnce(new TypeError('reload offline'));
  act(() => result.current.reload());
  await waitFor(() => expect(localStore.replica).toHaveBeenCalledOnce());
  const next = {...state, progress: {pageId: 'p2', recordedAt: '', updatedAt: ''}};
  api.mutate.mockResolvedValueOnce({state: next, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});
  await act(async () => {await result.current.mutate(mutation);});
  await act(async () => {fallback({state});});
  expect(result.current.state).toEqual(next);
  expect(result.current.status).toBe('synced');
});

it('exposes a local error and retry even when the fallback storage read never settles', async () => {
  localStore.supported.mockReturnValue(true); localStore.read.mockResolvedValue(null);
  localStore.replica.mockImplementationOnce(() => new Promise(() => {}));
  api.privateState.mockRejectedValueOnce(new TypeError('network failure'));
  const {result} = renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure}));
  await waitFor(() => expect(result.current.loadError).toBe(true));
  expect(result.current.state).toBeNull(); expect(result.current.busy).toBe(false);
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.state).toEqual(state));
  expect(result.current.loadError).toBe(false);
});

it.fails('accepts the first save acknowledgement after same-binding receipt refresh', async () => {
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});}));
  const {result, rerender} = renderHook(({current}) => usePrivateReader({api, selector, value: current, offline: false, allowAction: () => true, onFailure}), {initialProps: {current: value}});
  await waitFor(() => expect(result.current.state).toEqual(state));
  let request!: Promise<unknown>;
  act(() => {request = result.current.mutate(mutation).catch(error => error);});
  await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  rerender({current: {...structuredClone(value), access: {...value.access, receiptId: 'same-binding-fresh-receipt'}}});
  await act(async () => {finish(); await request;});
  expect(await request).toMatchObject({status: 'applied'});
  expect(result.current.canRetry).toBe(false);
});
