import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {activateOfflineAccount, commitOfflineSave, enqueuePrivateMutation, seedPrivateReplica, readPrivateReplica, readOfflineSave, chooseReaderRecovery, acknowledgePrivateMutation} from './offline-store';
import {prepareReaderUpgrade, finishReaderUpgrade} from './upgrade';

const now = Date.parse('2026-10-02T00:00:00Z');
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const value = readerFixture();
const initial: BulletinReaderState = {accountId: 'account-a', documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const mutation: BulletinReaderMutation = {mutationId: '00000000-0000-4000-8000-000000000010', documentRevision: 1, createdAt: new Date(now).toISOString(), kind: 'setHighlight', payload: {sentenceIds: ['s0'], color: 'yellow'}};
beforeEach(() => {
  vi.restoreAllMocks(); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {locks: {request: async (_name: string, options: unknown, callback?: () => Promise<unknown>) => typeof options === 'function' ? options() : callback!()}});
});
async function setup() {
  const epoch = await activateOfflineAccount(selector.accountId);
  await commitOfflineSave({selector, value, epoch, resources: [], size: 100, locked: false, lastObservedAt: now}, epoch, now);
  await seedPrivateReplica(selector, initial, epoch, now);
  await enqueuePrivateMutation(selector, mutation, epoch, now);
  const newer = structuredClone(value); newer.document.revision = newer.access.revision = newer.access.currentRevision = 2;
  let cloud: BulletinReaderState = {...initial, currentRevision: 2, appliedRevision: 2};
  const api = {renew: vi.fn().mockResolvedValue(value), current: vi.fn().mockResolvedValue(newer), privateState: vi.fn(async () => ({state: cloud, fromRevision: 1, mappings: ['s0', 's1', 's2', 's3'].map(id => ({fromSentenceId: id, toSentenceIds: [id]}))})), mutate: vi.fn(async (_selector, _value, mutations: BulletinReaderMutation[]) => {
    cloud = {...cloud, highlights: [{sentenceId: 's0', color: 'yellow', quote: '內容0。', active: true, version: 1, updatedAt: new Date(now).toISOString()}]};
    return {state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied' as const, revision: 2}]};
  })};
  return {epoch, api};
}
const fetchAsset = async (url: RequestInfo | URL) => new Response(await readFile(join(process.cwd(), 'public', String(url))));
it('keeps the old replica on download failure and never renumbers or resends an acknowledged rebased operation on retry', async () => {
  const {epoch, api} = await setup(); const signal = new AbortController().signal;
  const prepared = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  expect(prepared.recovery).toEqual([]);
  await expect(finishReaderUpgrade(api, selector, prepared, epoch, signal, async () => {throw new TypeError('asset offline');}, () => now)).rejects.toThrow('asset offline');
  expect((await readOfflineSave(selector, now))?.save.value.document.revision).toBe(1);
  expect((await readPrivateReplica(selector, now))?.queue[0]).toMatchObject({mutation, replay: {mutationId: mutation.mutationId, documentRevision: 2}, replayResult: {status: 'applied'}});
  const retry = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  await finishReaderUpgrade(api, selector, retry, epoch, signal, fetchAsset, () => now);
  expect(api.mutate).toHaveBeenCalledOnce();
  expect((await readOfflineSave(selector, now))?.save.value.document.revision).toBe(2);
  expect((await readPrivateReplica(selector, now))?.state.highlights[0].color).toBe('yellow');
  expect((await readPrivateReplica(selector, now))?.queue).toEqual([]);
});
it('does not discard a new offline action made in another tab while an upgrade was staged', async () => {
  const {epoch, api} = await setup(); const signal = new AbortController().signal;
  const prepared = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  await enqueuePrivateMutation(selector, {...mutation, mutationId: crypto.randomUUID(), payload: {sentenceIds: ['s1'], color: 'blue'}}, epoch, now);
  await expect(finishReaderUpgrade(api, selector, prepared, epoch, signal, fetchAsset, () => now)).rejects.toThrow('offline_replica_changed');
  expect((await readOfflineSave(selector, now))?.save.value.document.revision).toBe(1);
  expect((await readPrivateReplica(selector, now))?.queue).toHaveLength(2);
});
it('retains the original action and explicitly chosen recovery ID across interrupted same-revision recovery', async () => {
  const {epoch, api} = await setup(); const signal = new AbortController().signal;
  api.current.mockResolvedValue(value);
  api.privateState.mockResolvedValue({state: initial, fromRevision: 1, mappings: []});
  await acknowledgePrivateMutation(selector, {state: initial, results: [{mutationId: mutation.mutationId, revision: 1, status: 'recovery_required'}]}, epoch, now);
  let prepared = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  expect(prepared.recovery[0].reason).toBe('expired_mutation');
  const chosen = {...mutation, mutationId: crypto.randomUUID(), createdAt: new Date(now + 1).toISOString()};
  await chooseReaderRecovery(selector, mutation.mutationId, chosen, epoch, prepared.queue, now);
  expect((await readPrivateReplica(selector, now))?.queue[0]).toMatchObject({mutation, resolution: {mutation: chosen}});
  prepared = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  api.mutate.mockRejectedValueOnce(new TypeError('lost acknowledgement'));
  await expect(finishReaderUpgrade(api, selector, prepared, epoch, signal, fetchAsset, () => now)).rejects.toThrow('lost acknowledgement');
  api.mutate.mockResolvedValueOnce({state: initial, results: [{mutationId: chosen.mutationId, status: 'applied', revision: 1}]});
  prepared = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  expect(prepared.recovery).toEqual([]);
  await finishReaderUpgrade(api, selector, prepared, epoch, signal, fetchAsset, () => now);
  expect(api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual([chosen.mutationId, chosen.mutationId]);
  expect((await readOfflineSave(selector, now))?.save.value.document.revision).toBe(1);
  expect((await readPrivateReplica(selector, now))?.queue).toEqual([]);
});
it('does not automatically apply the other conflicting color after the first user decision', async () => {
  const {epoch, api} = await setup(); const signal = new AbortController().signal;
  const second: BulletinReaderMutation = {...mutation, mutationId: crypto.randomUUID(), payload: {sentenceIds: ['s1'], color: 'blue'}};
  await enqueuePrivateMutation(selector, second, epoch, now);
  api.privateState.mockResolvedValue({state: {...initial, currentRevision: 2, appliedRevision: 2}, fromRevision: 1, mappings: [{fromSentenceId: 's0', toSentenceIds: ['s0']}, {fromSentenceId: 's1', toSentenceIds: ['s0']}]});
  const prepared = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  expect(prepared.recovery).toHaveLength(2);
  await chooseReaderRecovery(selector, mutation.mutationId, null, epoch, prepared.queue, now);
  const next = await prepareReaderUpgrade(api, selector, value, epoch, signal, () => now);
  expect(next.recovery).toEqual([{mutationId: second.mutationId, reason: 'color_conflict'}]);
  expect(next.mutations).toEqual([]);
});
