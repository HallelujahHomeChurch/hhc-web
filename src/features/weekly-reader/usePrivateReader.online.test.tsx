import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {act, fireEvent, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {usePrivateReader} from './usePrivateReader';
import {applyLocalMutation} from './private-state';
import {activateOfflineAccount, readPrivateReplica, readOfflineSave} from './offline-store';
const storage = vi.hoisted(() => ({fail: false}));
vi.mock('./offline-store', async original => {const actual = await original<typeof import('./offline-store')>(); return {...actual, enqueuePrivateMutation: (...args: Parameters<typeof actual.enqueuePrivateMutation>) => storage.fail ? Promise.reject(new DOMException('full', 'QuotaExceededError')) : actual.enqueuePrivateMutation(...args)};});
const now = Date.parse('2026-10-02T00:00:00Z'), value = readerFixture();
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const note = {id: 'n', text: 'A', quote: '內容0。', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
const state: BulletinReaderState = {accountId: selector.accountId, documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, notes: [note], highlights: [], conflicts: [], progress: null};
const edit = (id: string, text: string, version: number): BulletinReaderMutation => ({mutationId: id, kind: 'editNote', documentRevision: 1, createdAt: new Date(now).toISOString(), baseVersion: version, payload: {noteId: note.id, text}});
beforeEach(async () => {storage.fail = false; sessionStorage.clear(); vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(now); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('navigator', {onLine: true, locks: {request: async (_name: string, options: unknown, work?: () => Promise<unknown>) => typeof options === 'function' ? options() : work!()}}); await activateOfflineAccount(selector.accountId);});
afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});
function mount() {
  let cloud = structuredClone(state);
  const api = {renew: vi.fn(async () => value), privateState: vi.fn(async () => ({state: structuredClone(cloud)})), mutate: vi.fn(async (_s, _v, writes: BulletinReaderMutation[]) => {cloud = applyLocalMutation(cloud, writes[0], value.document); return {state: cloud, results: [{mutationId: writes[0].mutationId, status: 'applied' as const, revision: 1}]};})};
  return {...renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => true, onFailure: vi.fn()})), api};
}
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
it('keeps accepted content and warns when an IDB quota failure requires memory fallback', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); storage.fail = true; h.api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  await act(async () => {expect(await h.result.current.mutate(edit('quota', 'B', 1))).toMatchObject({status: 'queued', durable: false});});
  await waitFor(() => expect(h.result.current.busy).toBe(false)); expect(h.result.current.state?.notes[0].text).toBe('B'); expect(h.result.current.unsaved).toBe(true);
  await act(async () => {await h.result.current.retry();}); expect(h.api.mutate.mock.calls[1][2][0].mutationId).toBe('quota'); expect(h.result.current.unsaved).toBe(false);
});

it('does not turn account-epoch drift into a memory writer after storage fallback', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); storage.fail = true; h.api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  await act(async () => {await h.result.current.mutate(edit('private-a', 'B', 1));}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  await activateOfflineAccount('account-b');
  await act(async () => {await h.result.current.retry().catch(() => {});});
  expect(h.api.mutate).toHaveBeenCalledOnce(); expect(h.result.current.status).toBe('action');
  await expect(h.result.current.mutate(edit('denied', 'C', 2))).rejects.toThrow();
});

it('resumes a durable unknown ID on connection restoration without another Save', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).not.toBeNull()); h.api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  const intent = edit('reconnect', 'B', 1); await act(async () => {await h.result.current.mutate(intent);}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  fireEvent(window, new Event('online')); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.api.mutate.mock.calls.map(call => call[2])).toEqual([[intent], [intent]]); expect(h.result.current.state?.notes[0].text).toBe('B');
});
