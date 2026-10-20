import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {usePrivateReader} from './usePrivateReader';
import {activateOfflineAccount, commitOfflineSave, seedPrivateReplica, enqueuePrivateMutation, claimPrivateMutation, readReaderExportLocal, clearOfflineAccount, readPrivateReplica} from './offline-store';
const now = Date.parse('2026-10-02T00:00:00Z'), value = readerFixture();
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const note = {id: 'note-a', text: 'Own text', quote: 'source', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
const state: BulletinReaderState = {accountId: selector.accountId, documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [note], progress: null, conflicts: []};
let epoch: number;
beforeEach(async () => {
  sessionStorage.clear(); vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(now);
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {locks: {request: async (_name: string, work: () => Promise<unknown>) => work()}});
  epoch = await activateOfflineAccount(selector.accountId);
  await commitOfflineSave({selector, value, resources: [], size: 1, epoch, lastObservedAt: now, locked: false}, epoch, now);
  await seedPrivateReplica(selector, state, epoch, now);
});
afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});
function mount(offline = true) {
  const api = {privateState: vi.fn().mockResolvedValue({state}), mutate: vi.fn(), renew: vi.fn()};
  const permitted = {value: true};
  const hook = renderHook(() => usePrivateReader({api, selector, value, offline, allowAction: () => permitted.value, onFailure: vi.fn()}));
  return {...hook, api, permitted};
}
it('captures complete unsent durable notes without syncing, and refuses a changed cross-tab queue at download', async () => {
  await enqueuePrivateMutation(selector, {mutationId: 'edit', kind: 'editNote', documentRevision: 1, createdAt: new Date(now).toISOString(), baseVersion: 1, payload: {noteId: note.id, text: 'Durable edit'}}, epoch, now);
  const hook = mount(); await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  let snapshot!: Awaited<ReturnType<typeof hook.result.current.prepareExport>>;
  await act(async () => {snapshot = await hook.result.current.prepareExport(null);});
  expect(snapshot.notes[0].text).toBe('Durable edit'); expect(snapshot.pendingNoteIds.has(note.id)).toBe(true);
  const handed = vi.fn(); await act(async () => {await snapshot.validate(handed);}); expect(handed).toHaveBeenCalledOnce();
  await enqueuePrivateMutation(selector, {mutationId: 'progress', kind: 'setProgress', documentRevision: 1, createdAt: new Date(now).toISOString(), payload: {pageId: 'p1'}}, epoch, now);
  await act(async () => {await expect(snapshot.validate(handed)).rejects.toThrow('export_changed');});
  expect(hook.api.mutate).not.toHaveBeenCalled(); expect(hook.api.renew).not.toHaveBeenCalled(); expect(hook.api.privateState).not.toHaveBeenCalled();
  expect((await readPrivateReplica(selector, now))?.queue).toHaveLength(2);
});
it('blocks sent/unknown queue entries and does not flush them', async () => {
  await enqueuePrivateMutation(selector, {mutationId: 'edit', kind: 'editNote', documentRevision: 1, createdAt: new Date(now).toISOString(), baseVersion: 1, payload: {noteId: note.id, text: 'Unknown'}}, epoch, now);
  await claimPrivateMutation(selector, epoch, now);
  await expect(readReaderExportLocal(selector, value.document.documentId, 1, now)).rejects.toThrow('export_unavailable');
});
it('rejects owner/epoch, receipt expiry, missing replica and newly replaced save instances', async () => {
  const hook = mount(); await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  let snapshot!: Awaited<ReturnType<typeof hook.result.current.prepareExport>>;
  await act(async () => {snapshot = await hook.result.current.prepareExport([note.id]);});
  await commitOfflineSave({selector, value, resources: [], size: 1, epoch, lastObservedAt: now, locked: false}, epoch, now);
  await act(async () => {await expect(snapshot.validate(vi.fn())).rejects.toThrow('export_changed');});
  await clearOfflineAccount(selector.accountId);
  await act(async () => {await expect(snapshot.validate(vi.fn())).rejects.toThrow();});
});
it('rejects qualification changes, unmounts and expiry without handing a file to the browser', async () => {
  const hook = mount(); await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  let snapshot!: Awaited<ReturnType<typeof hook.result.current.prepareExport>>;
  await act(async () => {snapshot = await hook.result.current.prepareExport(null);});
  const handed = vi.fn(); hook.permitted.value = false;
  await act(async () => {await expect(snapshot.validate(handed)).rejects.toThrow();}); expect(handed).not.toHaveBeenCalled();
  hook.permitted.value = true; vi.setSystemTime(Date.parse(value.access.offlineValidUntil));
  await act(async () => {await expect(snapshot.validate(handed)).rejects.toThrow('offline_access_expired');});
  hook.unmount(); await expect(snapshot.validate(handed)).rejects.toThrow();
});

it.each(['result', 'replay', 'replayResult', 'resolution', 'recoveryReason'])('blocks a durable %s marker and preserves all queued data', async marker => {
  await enqueuePrivateMutation(selector, {mutationId: 'edit', kind: 'editNote', documentRevision: 1, createdAt: new Date(now).toISOString(), baseVersion: 1, payload: {noteId: note.id, text: 'Keep local'}}, epoch, now);
  await new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open('hhc-weekly-reader', 2);
    opening.onsuccess = () => {
      const db = opening.result, tx = db.transaction('private', 'readwrite'), store = tx.objectStore('private'), keys = store.getAllKeys();
      keys.onsuccess = () => {const get = store.get(keys.result[0]); get.onsuccess = () => {const replica = get.result; replica.queue[0][marker] = null; store.put(replica, keys.result[0]);};};
      tx.oncomplete = () => {db.close(); resolve();}; tx.onabort = () => {db.close(); reject(tx.error);};
    };
  });
  await expect(readReaderExportLocal(selector, value.document.documentId, 1, now)).rejects.toThrow('export_unavailable');
  expect((await readPrivateReplica(selector, now))?.queue).toHaveLength(1);
});

it('reports the note limit clearly while allowing a smaller explicit filter without syncing',async()=>{
 await seedPrivateReplica(selector,{...state,notes:Array.from({length:201},(_,i)=>({...note,id:'n'+i}))},epoch,now);
 const hook=mount();await waitFor(()=>expect(hook.result.current.state?.notes).toHaveLength(201));
 await act(async()=>{await expect(hook.result.current.prepareExport(null)).rejects.toThrow('export_limit');});
 await act(async()=>{expect((await hook.result.current.prepareExport(['n0'])).notes.map(n=>n.id)).toEqual(['n0']);});
 expect(hook.api.mutate).not.toHaveBeenCalled();expect(hook.api.renew).not.toHaveBeenCalled();
});
