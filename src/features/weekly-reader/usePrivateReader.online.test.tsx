import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {act, fireEvent, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {usePrivateReader} from './usePrivateReader';
import {applyLocalMutation} from './private-state';
import {clearReaderReturns, readVolatileReader, readerReturnSnapshot, clearReaderReturnIfUnchanged, hasPendingReaderReturn} from './return-state';
import {activateOfflineAccount, readPrivateReplica, readOfflineSave, bindOnlinePrivate, seedPrivateReplica, enqueuePrivateMutation, chooseReaderRecovery, commitOnlineUpgrade, commitOfflineSave} from './offline-store';
const storage = vi.hoisted(() => ({fail: false, failBind: false}));
vi.mock('./offline-store', async original => {const actual = await original<typeof import('./offline-store')>(); return {...actual, bindOnlinePrivate: (...args: Parameters<typeof actual.bindOnlinePrivate>) => storage.failBind ? Promise.reject(new DOMException('full', 'QuotaExceededError')) : actual.bindOnlinePrivate(...args), enqueuePrivateMutation: (...args: Parameters<typeof actual.enqueuePrivateMutation>) => storage.fail ? Promise.reject(new DOMException('full', 'QuotaExceededError')) : actual.enqueuePrivateMutation(...args)};});
const now = Date.parse('2026-10-02T00:00:00Z'), value = readerFixture();
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const note = {id: 'n', text: 'A', quote: '內容0。', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
const state: BulletinReaderState = {accountId: selector.accountId, documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, notes: [note], highlights: [], conflicts: [], progress: null};
const edit = (id: string, text: string, version: number): BulletinReaderMutation => ({mutationId: id, kind: 'editNote', documentRevision: 1, createdAt: new Date(now).toISOString(), baseVersion: version, payload: {noteId: note.id, text}});
beforeEach(async () => {storage.fail = false; storage.failBind = false; sessionStorage.clear(); vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(now); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('navigator', {onLine: true, locks: {request: async (_name: string, options: unknown, work?: () => Promise<unknown>) => typeof options === 'function' ? options() : work!()}}); await activateOfflineAccount(selector.accountId);});
afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});
function mount(offline = false) {
  let cloud = structuredClone(state);
  const api = {renew: vi.fn(async () => value), privateState: vi.fn(async () => ({state: structuredClone(cloud)})), mutate: vi.fn(async (_s, _v, writes: BulletinReaderMutation[]) => {cloud = applyLocalMutation(cloud, writes[0], value.document); return {state: cloud, results: [{mutationId: writes[0].mutationId, status: 'applied' as const, revision: 1}]};})};
  return {...renderHook(() => usePrivateReader({api, selector, value, offline, allowAction: () => true, onFailure: vi.fn()})), api};
}
it('accepts more highlights and a new note after sync renews the original receipt', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  const renewed = {...value, access: {...value.access, receiptId: 'renewed', validatedAt: new Date(now + 1000).toISOString(), offlineValidUntil: new Date(now + 1000 + 604800000).toISOString()}};
  h.api.renew.mockResolvedValue(renewed);
  const highlight = (id: string, sentenceId: string): BulletinReaderMutation => ({mutationId: id, kind: 'setHighlight', documentRevision: 1, createdAt: new Date(now).toISOString(), payload: {sentenceIds: [sentenceId], color: 'yellow'}});
  await act(async () => {await h.result.current.mutate(highlight('first', 's0'));});
  await waitFor(() => expect(h.result.current.status).toBe('synced'));
  await act(async () => {await h.result.current.mutate(highlight('second', 's1'));});
  await act(async () => {await h.result.current.mutate({mutationId: 'new-note', kind: 'createNote', documentRevision: 1, createdAt: new Date(now).toISOString(), payload: {noteId: 'new', sentenceIds: ['s1'], text: 'Keep writing'}});});
  await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual(['first', 'second', 'new-note']);
  expect(h.result.current.state?.notes.find(note => note.id === 'new')?.text).toBe('Keep writing');
});
it('journals online-only writes during a slow send and applies both once without a publication download', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state?.notes[0].text).toBe('A'));
  let finish!: () => void;
  h.api.mutate.mockImplementationOnce(async (_s, _v, writes) => {await new Promise<void>(resolve => {finish = resolve;}); return {state: applyLocalMutation(state, writes[0], value.document), results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]};});
  h.api.mutate.mockImplementation(async (_s, _v, writes) => ({state: {...state, notes: [{...note, text: 'C', version: 3}]}, results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]}));
  await act(async () => {expect(await h.result.current.mutate(edit('a', 'B', 1))).toMatchObject({status: 'queued', durable: true});});
  await waitFor(() => expect(h.api.mutate).toHaveBeenCalledOnce());
  await act(async () => {await h.result.current.mutate(edit('b', 'C', 2));});
  expect(h.result.current.state?.notes[0]).toMatchObject({text: 'C', version: 3}); expect((await readPrivateReplica(selector))?.queue).toHaveLength(2);
  await act(async () => finish()); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.result.current.state?.notes[0]).toMatchObject({text: 'C', version: 3}); expect(h.api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual(['a', 'b']);
  expect(await readOfflineSave(selector)).toBeNull(); expect((await readPrivateReplica(selector))?.queue).toEqual([]);
});
it('retains unknown durable IDs across a cold mount and retries them without asking for a second Save', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); h.api.mutate.mockRejectedValueOnce(new TypeError('lost'));
  const intent = edit('unknown', 'B', 1); await act(async () => {await h.result.current.mutate(intent);}); await waitFor(() => expect(h.result.current.busy).toBe(false)); h.unmount();
  const next = mount(); await waitFor(() => expect(next.result.current.status).toBe('synced'));
  expect(next.api.mutate.mock.calls[0][2]).toEqual([intent]); expect(next.result.current.state?.notes[0].text).toBe('B');
});
it.each([false, true])('automatically retries a transient failure without another Save or online event (memory=%s)', async memory => {
  storage.failBind = memory;
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockRejectedValueOnce(new TypeError('temporary network failure'));
  const intent = edit('automatic-retry', 'B', 1);
  await act(async () => {await h.result.current.mutate(intent);});
  await waitFor(() => expect(h.result.current.status).toBe('waiting'));
  expect(h.result.current.canRetry).toBe(memory);
  await waitFor(() => expect(h.result.current.status).toBe('synced'), {timeout: 3000});
  expect(h.api.mutate.mock.calls.map(call => call[2])).toEqual([[intent], [intent]]);
  expect(h.result.current.state?.notes[0].text).toBe('B');
});
it('cancels a scheduled background retry when the reader unmounts', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockRejectedValue(new TypeError('network failure'));
  await act(async () => {await h.result.current.mutate(edit('leaving', 'B', 1));});
  await waitFor(() => expect(h.result.current.status).toBe('waiting'));
  h.unmount();
  await new Promise(resolve => setTimeout(resolve, 1100));
  expect(h.api.mutate).toHaveBeenCalledOnce();
});
it('keeps accepted content and warns when an IDB quota failure requires memory fallback', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); storage.fail = true; h.api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  await act(async () => {expect(await h.result.current.mutate(edit('quota', 'B', 1))).toMatchObject({status: 'queued', durable: false});});
  await waitFor(() => expect(h.result.current.busy).toBe(false)); expect(h.result.current.state?.notes[0].text).toBe('B'); expect(h.result.current.unsaved).toBe(true);
  await act(async () => {await h.result.current.retry();}); expect(h.api.mutate.mock.calls[1][2][0].mutationId).toBe('quota'); expect(h.result.current.unsaved).toBe(false);
});

it('retains every RAM intent through a temporary authentication unmount and retries the original IDs', async () => {
  storage.failBind = true;
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockRejectedValue(new TypeError('offline'));
  await act(async () => {await h.result.current.mutate(edit('ram-first', 'B', 1));});
  await waitFor(() => expect(h.result.current.busy).toBe(false));
  await act(async () => {await h.result.current.mutate(edit('ram-second', 'C', 2));});
  await waitFor(() => expect(h.result.current.busy).toBe(false)); h.unmount();
  const next = mount(); await waitFor(() => expect(next.result.current.status).toBe('synced'));
  expect(next.result.current.state?.notes[0].text).toBe('C');
  expect(next.api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual(['ram-first', 'ram-second']);
  expect(next.result.current.status).toBe('synced'); expect(next.result.current.unsaved).toBe(false);
});

it('keeps all RAM intents on a receipt-validated offline remount before a fresh online resume', async () => {
  storage.failBind = true; const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockRejectedValue(new TypeError('offline'));
  await act(async () => {await h.result.current.mutate(edit('offline-ram-one', 'B', 1));}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  await act(async () => {await h.result.current.mutate(edit('offline-ram-two', 'C', 2));}); await waitFor(() => expect(h.result.current.busy).toBe(false)); h.unmount();
  const epoch = await activateOfflineAccount(selector.accountId);
  await commitOfflineSave({selector, value, resources: [], size: 0, lastObservedAt: now, epoch, locked: false}, epoch, now);
  const local = mount(true); await waitFor(() => expect(local.result.current.state?.notes[0].text).toBe('C'));
  expect(local.api.privateState).not.toHaveBeenCalled(); expect(local.api.mutate).not.toHaveBeenCalled(); expect(local.result.current.unsaved).toBe(true); local.unmount();
  const online = mount(); await waitFor(() => expect(online.result.current.status).toBe('synced'));
  expect(online.api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual(['offline-ram-one', 'offline-ram-two']);
});

it('includes volatile writes in removal snapshots and purges them on account change', async () => {
  storage.failBind = true; const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockRejectedValue(new TypeError('offline'));
  await act(async () => {await h.result.current.mutate(edit('ram-one', 'B', 1));}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  const binding = {accountId: selector.accountId, documentId: value.document.documentId};
  const snapshot = readerReturnSnapshot(binding);
  await act(async () => {await h.result.current.mutate(edit('ram-two', 'C', 2));}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  clearReaderReturnIfUnchanged(binding, snapshot);
  expect(readVolatileReader(binding)?.replica.queue).toHaveLength(2); expect(hasPendingReaderReturn(selector.accountId)).toBe(true);
  h.unmount(); clearReaderReturns('account-b');
  expect(readVolatileReader(binding)).toBeUndefined(); expect(hasPendingReaderReturn(selector.accountId)).toBe(false);
});

it('rejects a retained RAM journal after its known owner epoch changes', async () => {
  storage.failBind = true; const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockRejectedValue(new TypeError('offline'));
  await act(async () => {await h.result.current.mutate(edit('ram-old-epoch', 'B', 1));}); await waitFor(() => expect(h.result.current.busy).toBe(false)); h.unmount();
  await activateOfflineAccount('account-b');
  const next = mount(); await waitFor(() => expect(next.result.current.loadError).toBe(true));
  expect(next.api.mutate).not.toHaveBeenCalled(); expect(next.result.current.state).toBeNull();
  expect(readVolatileReader({accountId: selector.accountId, documentId: value.document.documentId})).toBeUndefined();
});

it('aborts an account-switched RAM writer before a late acknowledgement can retain private state again', async () => {
  storage.failBind = true; const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  let finish!: () => void;
  h.api.mutate.mockImplementationOnce(async (_s, _v, writes) => {await new Promise<void>(resolve => {finish = resolve;}); return {state: applyLocalMutation(state, writes[0], value.document), results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]};});
  await act(async () => {await h.result.current.mutate(edit('late-old-account', 'B', 1));}); await waitFor(() => expect(h.api.mutate).toHaveBeenCalledOnce());
  act(() => window.dispatchEvent(new CustomEvent('hhc:weekly-reader-account', {detail: {accountId: 'account-b'}})));
  await act(async () => finish());
  expect(h.result.current.state).toBeNull(); expect(readVolatileReader({accountId: selector.accountId, documentId: value.document.documentId})).toBeUndefined();
});

it('does not turn account-epoch drift into a memory writer after storage fallback', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); storage.fail = true; h.api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  await act(async () => {await h.result.current.mutate(edit('private-a', 'B', 1));}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  await activateOfflineAccount('account-b');
  await act(async () => {await h.result.current.retry().catch(() => {});});
  expect(h.api.mutate).toHaveBeenCalledOnce(); expect(h.result.current.status).toBe('action');
  await expect(h.result.current.mutate(edit('denied', 'C', 2))).rejects.toThrow();
});

it.each([false, true])('resumes an unknown ID on connection restoration without another Save (memory=%s)', async memory => {
  storage.failBind = memory;
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); h.api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  const intent = edit('reconnect', 'B', 1); await act(async () => {await h.result.current.mutate(intent);}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  fireEvent(window, new Event('online')); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.api.mutate.mock.calls.map(call => call[2])).toEqual([[intent], [intent]]); expect(h.result.current.state?.notes[0].text).toBe('B');
});

it('retains the known epoch when initialization quota fails and warns throughout a delayed acknowledgement', async () => {
  storage.failBind = true; const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull());
  h.api.mutate.mockImplementationOnce(() => new Promise(() => {}));
  await act(async () => {await h.result.current.mutate(edit('init-quota', 'B', 1));}); await waitFor(() => expect(h.api.mutate).toHaveBeenCalledOnce());
  expect(h.result.current.unsaved).toBe(true); expect(h.result.current.hasUncommitted()).toBe(true); expect(h.result.current.busy).toBe(true);
});
it('serializes memory fallback with a durable writer in another tab using the same account lock', async () => {
  const tails = new Map<string, Promise<unknown>>(), lockNames: string[] = [];
  vi.stubGlobal('navigator', {onLine: true, locks: {request: (name: string, options: unknown, work?: () => Promise<unknown>) => {
    const callback = typeof options === 'function' ? options as () => Promise<unknown> : work!;
    const next = (tails.get(name) ?? Promise.resolve()).then(callback); tails.set(name, next.catch(() => {})); lockNames.push(name); return next;
  }}});
  const a = mount(), b = mount(); await waitFor(() => {expect(a.result.current.state).not.toBeNull(); expect(b.result.current.state).not.toBeNull();});
  let release!: () => void;
  a.api.mutate.mockImplementationOnce(async (_s, _v, writes) => {await new Promise<void>(resolve => {release = resolve;}); return {state: applyLocalMutation(state, writes[0], value.document), results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]};});
  await act(async () => {await a.result.current.mutate(edit('tab-a', 'B', 1));}); await waitFor(() => expect(a.api.mutate).toHaveBeenCalledOnce());
  storage.fail = true;
  await act(async () => {await b.result.current.mutate(edit('tab-b', 'C', 1));}); expect(b.api.mutate).not.toHaveBeenCalled();
  await act(async () => release()); await waitFor(() => expect(b.api.mutate).toHaveBeenCalledOnce());
  expect(lockNames.filter(name => name === 'hhc-weekly-reader-sync:account-a')).toHaveLength(2);
});

it('does not revive a persisted old-revision journal after an explicit recovery commit and reload', async () => {
  const epoch = await activateOfflineAccount(selector.accountId);
  await bindOnlinePrivate(selector, value, epoch); await seedPrivateReplica(selector, state, epoch); await enqueuePrivateMutation(selector, edit('old-revision', 'B', 1), epoch);
  const current = {...structuredClone(value), document: {...value.document, revision: 2}, access: {...value.access, revision: 2, currentRevision: 2, receiptId: 'current', validatedAt: new Date(now).toISOString(), offlineValidUntil: new Date(now + 604800000).toISOString()}};
  const cloud = {...state, appliedRevision: 2, currentRevision: 2};
  const api = {privateState: vi.fn(async () => ({state: cloud})), renew: vi.fn(async () => current), mutate: vi.fn()};
  const h = renderHook(() => usePrivateReader({api, selector, value: current, offline: false, allowAction: () => true, onFailure: vi.fn()}));
  await waitFor(() => expect(h.result.current.status).toBe('paused')); expect(h.result.current.hasUncommitted()).toBe(false);
  const original = (await readPrivateReplica(selector))!;
  const queue = await chooseReaderRecovery(selector, 'old-revision', null, epoch, original.queue);
  await commitOnlineUpgrade(selector, current, cloud, epoch, 1, queue);
  act(() => h.result.current.reload()); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.result.current.state).toEqual(cloud); expect(h.result.current.pendingMutation).toBeNull(); expect(api.mutate).not.toHaveBeenCalled();
});
