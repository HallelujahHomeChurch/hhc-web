import {webcrypto} from 'node:crypto';
import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {activateOfflineAccount, clearOfflineAccount, commitOfflineSave, enqueuePrivateMutation, seedPrivateReplica, readPrivateReplica, claimPrivateMutation, acknowledgePrivateMutation, hasPendingReaderWrites, checkOfflineSave, renewOfflineSave} from './offline-store';

const now = Date.parse('2026-10-01T01:00:00Z');
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const value = readerFixture();
const state: BulletinReaderState = {accountId: selector.accountId, documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const note: BulletinReaderMutation = {mutationId: '00000000-0000-4000-8000-000000000010', documentRevision: 1, createdAt: new Date(now).toISOString(), kind: 'createNote', payload: {noteId: '00000000-0000-4000-8000-000000000011', sentenceIds: ['s0'], text: '不可遺失的筆記'}};
beforeEach(() => {
  vi.restoreAllMocks(); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {locks: {request: async (_name: string, callback: () => Promise<unknown>) => callback()}});
});
async function saved() {
  const epoch = await activateOfflineAccount(selector.accountId);
  await commitOfflineSave({selector, value, epoch, resources: [], size: 100, locked: false, lastObservedAt: now}, epoch, now);
  await seedPrivateReplica(selector, state, epoch, now);
  return epoch;
}
it('atomically enqueues a note and its visible state, retains its ID on retry, and clears only after acknowledgement', async () => {
  const epoch = await saved();
  const local = await enqueuePrivateMutation(selector, note, epoch, now);
  expect(local.state.notes[0].text).toBe('不可遺失的筆記');
  expect(await hasPendingReaderWrites(selector.accountId)).toBe(true);
  await enqueuePrivateMutation(selector, note, epoch, now);
  expect((await readPrivateReplica(selector, now))?.queue).toHaveLength(1);
  const claimed = await claimPrivateMutation(selector, epoch, now);
  expect(claimed?.mutation).toEqual(note);
  expect((await claimPrivateMutation(selector, epoch, now))?.mutation).toEqual(note);
  await acknowledgePrivateMutation(selector, {state: local.state, results: [{mutationId: note.mutationId, revision: 1, status: 'applied'}]}, epoch, now);
  expect((await readPrivateReplica(selector, now))?.state.notes).toHaveLength(1);
  expect(await hasPendingReaderWrites(selector.accountId)).toBe(false);
});
it('rolls back quota failures, rejects expiry and stale logout epochs, and purges queued private text on account change', async () => {
  const epoch = await saved();
  const put = IDBObjectStore.prototype.put;
  const fail = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
    if (this.name === 'private') throw new DOMException('Full', 'QuotaExceededError');
    return put.apply(this, args);
  });
  await expect(enqueuePrivateMutation(selector, note, epoch, now)).rejects.toMatchObject({name: 'QuotaExceededError'});
  fail.mockRestore();
  expect((await readPrivateReplica(selector, now))?.state.notes).toEqual([]);
  await enqueuePrivateMutation(selector, note, epoch, now);
  await expect(enqueuePrivateMutation(selector, {...note, mutationId: crypto.randomUUID()}, epoch, Date.parse(value.access.offlineValidUntil))).rejects.toThrow();
  expect(await hasPendingReaderWrites(selector.accountId)).toBe(true);
  await clearOfflineAccount(selector.accountId);
  await activateOfflineAccount(selector.accountId);
  await expect(seedPrivateReplica(selector, state, epoch, now)).rejects.toThrow();
  expect(await hasPendingReaderWrites(selector.accountId)).toBe(false);
});
it('coalesces only unsent progress, preserves atomic highlight groups and stops on note conflicts', async () => {
  const epoch = await saved();
  const progress: BulletinReaderMutation = {...note, kind: 'setProgress', payload: {pageId: 'p0'}};
  await enqueuePrivateMutation(selector, progress, epoch, now);
  const latest = {...progress, mutationId: crypto.randomUUID(), payload: {pageId: 'p1'}};
  await enqueuePrivateMutation(selector, latest, epoch, now);
  expect((await readPrivateReplica(selector, now))?.queue.map(entry => entry.mutation.mutationId)).toEqual([latest.mutationId]);
  await claimPrivateMutation(selector, epoch, now);
  await enqueuePrivateMutation(selector, {...progress, mutationId: crypto.randomUUID()}, epoch, now);
  expect((await readPrivateReplica(selector, now))?.queue).toHaveLength(2);
  await acknowledgePrivateMutation(selector, {state, results: [{mutationId: latest.mutationId, revision: 1, status: 'note_conflict'}]}, epoch, now);
  expect(await claimPrivateMutation(selector, epoch, now)).toBeNull();
  expect((await readPrivateReplica(selector, now))?.queue[0].result?.status).toBe('note_conflict');
});
it('persists a rollback lock even when a private action is rejected', async () => {
  const epoch = await saved();
  await readPrivateReplica(selector, now + 1000);
  await expect(enqueuePrivateMutation(selector, note, epoch, now)).rejects.toThrow('offline_access_expired');
  expect(await checkOfflineSave(selector, 1, now + 2000)).toBe('revalidation_required');
});
it('retains operations older than 90 days for explicit recovery after successful reauthorization', async () => {
  const epoch = await saved();
  await enqueuePrivateMutation(selector, note, epoch, now);
  const later = now + 91 * 86400000;
  const renewed = structuredClone(value);
  renewed.access.validatedAt = new Date(later).toISOString();
  renewed.access.offlineValidUntil = new Date(later + 7 * 86400000).toISOString();
  await renewOfflineSave(selector, renewed, epoch, later);
  expect(await claimPrivateMutation(selector, epoch, later)).toBeNull();
  expect((await readPrivateReplica(selector, later))?.queue[0]).toMatchObject({mutation: note, result: {status: 'recovery_required'}});
});
