import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, expect, it, vi} from 'vitest';
import {HhcWebApiError, type BulletinReaderMutation, type BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {activateOfflineAccount, clearOfflineAccount, commitOfflineSave, enqueuePrivateMutation, seedPrivateReplica, readPrivateReplica, listOfflineSaves, readOfflineSave} from './offline-store';
import {syncPrivateReplica} from './sync';

const now = Date.parse('2026-10-02T00:00:00Z');
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const value = readerFixture();
const state: BulletinReaderState = {accountId: selector.accountId, documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const mutation: BulletinReaderMutation = {mutationId: '00000000-0000-4000-8000-000000000010', documentRevision: 1, createdAt: new Date(now).toISOString(), kind: 'setHighlight', payload: {sentenceIds: ['s0', 's1'], color: 'yellow'}};
beforeEach(() => {
  vi.restoreAllMocks(); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {locks: {request: async (_name: string, _options: unknown, callback?: () => Promise<unknown>) => typeof _options === 'function' ? _options() : callback!()}});
});
async function saved() {
  const epoch = await activateOfflineAccount(selector.accountId);
  await commitOfflineSave({selector, value, epoch, resources: [], size: 100, locked: false, lastObservedAt: now}, epoch, now);
  await seedPrivateReplica(selector, state, epoch, now);
  const local = await enqueuePrivateMutation(selector, mutation, epoch, now);
  return {epoch, local};
}
it('reauthorizes before replay, retries the same atomic ID after interruption and records server acknowledgement', async () => {
  const {epoch, local} = await saved();
  const calls: string[] = [];
  const api = {renew: vi.fn(async () => {calls.push('authorize'); return value;}), privateState: vi.fn(async () => {calls.push('state'); return {state};}), mutate: vi.fn(async (_selector, _value, mutations) => {
    calls.push(`mutate:${mutations[0].mutationId}`);
    if (calls.filter(call => call.startsWith('mutate:')).length === 1) throw new TypeError('network');
    return {state: local.state, results: [{mutationId: mutation.mutationId, status: 'applied' as const, revision: 1}]};
  })};
  await expect(syncPrivateReplica(api, selector, value, epoch, new AbortController().signal, () => now)).rejects.toThrow('network');
  expect((await readPrivateReplica(selector, now))?.queue[0].mutation).toEqual(mutation);
  expect((await syncPrivateReplica(api, selector, value, epoch, new AbortController().signal, () => now)).status).toBe('synced');
  expect(calls).toEqual(['authorize', 'state', `mutate:${mutation.mutationId}`, 'authorize', 'state', `mutate:${mutation.mutationId}`]);
  expect((await readPrivateReplica(selector, now))?.state.highlights.map(highlight => highlight.color)).toEqual(['yellow', 'yellow']);
});
it('pauses on a newer revision without binding current private state to the old paper', async () => {
  const {epoch} = await saved();
  const api = {renew: vi.fn().mockResolvedValue({...value, access: {...value.access, currentRevision: 2}}), privateState: vi.fn().mockResolvedValue({state: {...state, appliedRevision: 2, currentRevision: 2}}), mutate: vi.fn()};
  expect((await syncPrivateReplica(api, selector, value, epoch, new AbortController().signal, () => now)).status).toBe('paused');
  expect((await readPrivateReplica(selector, now))?.state.currentRevision).toBe(1);
  expect(api.mutate).not.toHaveBeenCalled();
});
it.each([false, true])('locks generic 404 and purges only owner denial (%s)', async marked => {
  const {epoch} = await saved();
  const api = {renew: vi.fn().mockRejectedValue(new HhcWebApiError(404, 'not_found', 'Unavailable', undefined, undefined, marked)), privateState: vi.fn(), mutate: vi.fn()};
  await expect(syncPrivateReplica(api, selector, value, epoch, new AbortController().signal, () => now)).rejects.toMatchObject({status: 404});
  expect(await listOfflineSaves(selector.accountId)).toHaveLength(marked ? 0 : 1);
  expect((await readOfflineSave(selector, now))?.status ?? 'unavailable').toBe(marked ? 'unavailable' : 'revalidation_required');
});
it('does not resurrect private state after logout wins over a delayed sync response', async () => {
  const {epoch, local} = await saved();
  const api = {renew: vi.fn().mockResolvedValue(value), privateState: vi.fn().mockResolvedValue({state}), mutate: vi.fn(async () => {
    await clearOfflineAccount(selector.accountId);
    return {state: local.state, results: [{mutationId: mutation.mutationId, status: 'applied' as const, revision: 1}]};
  })};
  await expect(syncPrivateReplica(api, selector, value, epoch, new AbortController().signal, () => now)).rejects.toThrow('offline_account_changed');
  expect(await listOfflineSaves(selector.accountId)).toEqual([]);
});
