import {webcrypto} from 'node:crypto';
import {IDBFactory, IDBObjectStore, IDBTransaction} from 'fake-indexeddb';
import {beforeEach, expect, it, vi} from 'vitest';
import {readerFixture} from './test-fixture';
import {activateOfflineAccount, commitOfflineSave, listOfflineSaves, readOfflineRemovalSnapshot, removeOfflineSave, type OfflineSave} from './offline-store';
import {readReaderReturn, saveReaderReturn} from './return-state';

const now = Date.parse('2026-10-01T01:00:00Z');
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const binding = {accountId: selector.accountId, documentId: readerFixture().access.documentId};
const key = [binding.accountId, binding.documentId, 'general', 'zh-Hant', 1];
const staged = (): OfflineSave => ({selector, value: readerFixture(), resources: [], size: 0, lastObservedAt: now, epoch: -1, locked: false});
async function edit(store: string, work: (store: IDBObjectStore) => void) {
  const request = indexedDB.open('hhc-weekly-reader', 2);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
  try {await new Promise<void>((resolve, reject) => {const tx = db.transaction(store, 'readwrite'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); work(tx.objectStore(store));});}
  finally {db.close();}
}
beforeEach(() => {
  vi.restoreAllMocks(); sessionStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {locks: {request: async (_: string, run: () => Promise<unknown>) => run()}});
});
async function seed() {const epoch = await activateOfflineAccount(selector.accountId); await commitOfflineSave(staged(), epoch, now); return epoch;}
it('gives every same-revision save a new instance and refuses a stale removal', async () => {
  const epoch = await seed(), expected = await readOfflineRemovalSnapshot(selector);
  await commitOfflineSave(staged(), epoch, now);
  expect((await readOfflineRemovalSnapshot(selector)).instanceId).not.toBe(expected.instanceId);
  await expect(removeOfflineSave(selector, expected)).rejects.toThrow('offline_replica_changed');
  expect(await listOfflineSaves(selector.accountId)).toHaveLength(1);
});
it('assigns a stable removal instance to legacy downloads without requiring valid online access', async () => {
  await seed();
  await edit('documents', store => {const get = store.get(key); get.onsuccess = () => {const save = get.result; delete save.instanceId; save.locked = true; store.put(save, key);};});
  const expected = await readOfflineRemovalSnapshot(selector);
  expect(expected.instanceId).toBeTruthy(); expect((await readOfflineRemovalSnapshot(selector)).instanceId).toBe(expected.instanceId);
  await removeOfflineSave(selector, expected); expect(await listOfflineSaves(selector.accountId)).toHaveLength(0);
});
it.each(['old-revision', 'payload', 'epoch', 'pointer'] as const)('refuses %s drift while preserving the download', async change => {
  await seed();
  const oldKey = [...key.slice(0, 4), 0];
  const queue = [{mutation: {mutationId: 'q', kind: 'createNote', payload: {text: 'first'}}, sent: false}];
  await edit('private', store => store.put({queue}, oldKey));
  const expected = await readOfflineRemovalSnapshot(selector); expect(expected.pending).toBe(true);
  if (change === 'old-revision') await edit('private', store => store.put({queue: [...queue, {mutation: {mutationId: 'second'}, sent: false}]}, oldKey));
  if (change === 'payload') await edit('private', store => store.put({queue: [{...queue[0], resolution: {mutation: {payload: {text: 'new resolution'}}}}]}, oldKey));
  if (change === 'epoch') await edit('identity', store => store.put({accountId: selector.accountId, epoch: expected.epoch + 1}, 'active'));
  if (change === 'pointer') await edit('pointers', store => store.put([...key.slice(0, 4), 2], [selector.accountId, selector.issueNumber, selector.series, selector.contentLocale]));
  await expect(removeOfflineSave(selector, expected)).rejects.toThrow(/offline_(replica|account)_changed/);
  expect(await listOfflineSaves(selector.accountId)).toHaveLength(change === 'pointer' ? 0 : 1);
  // A stale pointer cannot authorize deletion of the retained document either.
  await edit('documents', store => {const get = store.get(key); get.onsuccess = () => expect(get.result).toBeTruthy();});
});
it.each(['before', 'during'] as const)('aborts if a new per-tab draft appears %s removal commit', async timing => {
  await seed(); const expected = await readOfflineRemovalSnapshot(selector);
  const write = () => saveReaderReturn(binding, {revision: 1, draft: {text: 'retain new draft'}});
  if (timing === 'before') write();
  else {const original = IDBObjectStore.prototype.delete; let written = false; vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function(this: IDBObjectStore, target) {if (!written) {written = true; write();} return original.call(this, target);});}
  await expect(removeOfflineSave(selector, expected)).rejects.toThrow('offline_replica_changed');
  expect(await listOfflineSaves(selector.accountId)).toHaveLength(1); expect(readReaderReturn(binding)?.draft?.text).toBe('retain new draft');
});
it('removes every revision and only the unchanged return after an accepted decision', async () => {
  await seed(); saveReaderReturn(binding, {revision: 1, draft: {text: 'old draft'}});
  await edit('private', store => store.put({queue: [{sent: true, mutation: {mutationId: 'old'}}]}, [...key.slice(0, 4), 0]));
  const expected = await readOfflineRemovalSnapshot(selector); expect(expected.pending).toBe(true);
  await removeOfflineSave(selector, expected);
  expect(await listOfflineSaves(selector.accountId)).toHaveLength(0); expect(readReaderReturn(binding)).toBeNull();
  await edit('private', store => {const get = store.getAllKeys(); get.onsuccess = () => expect(get.result).toHaveLength(0);});
});
it('retains a new per-tab return written after IDB commit was requested', async () => {
  await seed(); const expected = await readOfflineRemovalSnapshot(selector);
  const original = IDBTransaction.prototype.commit;
  vi.spyOn(IDBTransaction.prototype, 'commit').mockImplementation(function(this: IDBTransaction) {original.call(this); saveReaderReturn(binding, {revision: 1, draft: {text: 'after commit'}});});
  await removeOfflineSave(selector, expected);
  expect(await listOfflineSaves(selector.accountId)).toHaveLength(0); expect(readReaderReturn(binding)?.draft?.text).toBe('after commit');
});
