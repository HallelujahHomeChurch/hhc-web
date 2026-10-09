import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {beforeEach, expect, it, vi} from 'vitest';
import {readerFixture} from './test-fixture';
import {activateOfflineAccount, clearOfflineAccount, commitOfflineSave, getOfflineIdentity, listOfflineSaves, readOfflineSave, removeOfflineSave, stageOfflineSave, lockOfflineSave, renewOfflineSave, supportsOfflineReader} from './offline-store';

const now = Date.parse('2026-10-01T01:00:00Z');
const route = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const fetchAsset = vi.fn(async (url: RequestInfo | URL) => new Response(await readFile(join(process.cwd(), 'public', String(url)))));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {locks: {request: async (_name: string, callback: () => Promise<unknown>) => callback()}});
  fetchAsset.mockClear();
});

it('atomically saves an exact account edition with hash-verified resources, then locks at expiry without deleting it', async () => {
  const epoch = await activateOfflineAccount('account-a');
  const stage = await stageOfflineSave(readerFixture(), route, fetchAsset, now);
  await commitOfflineSave(stage, epoch, now);
  const saves = await listOfflineSaves('account-a');
  expect(saves).toHaveLength(1);
  expect(saves[0].size).toBeGreaterThan(0);
  expect((await readOfflineSave(route, now))?.status).toBe('available');
  expect((await readOfflineSave(route, Date.parse(readerFixture().access.offlineValidUntil)))?.status).toBe('expired');
  expect(await listOfflineSaves('account-a')).toHaveLength(1);
  expect(await readOfflineSave({...route, accountId: 'account-b'}, now)).toBeNull();
  expect(await readOfflineSave({...route, issueNumber: 1740}, now)).toBeNull();
});

it('retains Traditional and Simplified offline editions independently with verified V2 fonts',async()=>{
  const epoch=await activateOfflineAccount(route.accountId);
  const hans={...route,contentLocale:'zh-Hans' as const};
  await commitOfflineSave(await stageOfflineSave(readerFixture(),route,fetchAsset,now),epoch,now);
  await commitOfflineSave(await stageOfflineSave(readerFixture('zh-Hans'),hans,fetchAsset,now),epoch,now);
  expect(await listOfflineSaves(route.accountId)).toHaveLength(2);
  expect((await readOfflineSave(hans,now))?.save.value.document.documentId).not.toBe((await readOfflineSave(route,now))?.save.value.document.documentId);
  await removeOfflineSave(hans);
  expect(await readOfflineSave(hans,now)).toBeNull();
  expect((await readOfflineSave(route,now))?.status).toBe('available');
});

it.each([undefined,'v3','v4','v5','v6'] as const)('retains both language editions with renderer %s and unchanged seven-day expiry',async rendererVersion=>{
  const epoch=await activateOfflineAccount(route.accountId);
  for(const contentLocale of ['zh-Hant','zh-Hans'] as const){
    const value=readerFixture(contentLocale,rendererVersion),selector={...route,contentLocale};
    await commitOfflineSave(await stageOfflineSave(value,selector,fetchAsset,now),epoch,now);
    const saved=await readOfflineSave(selector,now);
    expect(saved?.status).toBe('available');
    expect(saved?.save.value.document.content.layoutManifest.rendererVersion).toBe(rendererVersion??(contentLocale==='zh-Hans'?'v2':'v1'));
    expect((await readOfflineSave(selector,Date.parse(value.access.offlineValidUntil)-1))?.status).toBe('available');
    expect((await readOfflineSave(selector,Date.parse(value.access.offlineValidUntil)))?.status).toBe('expired');
    expect(await readOfflineSave({...selector,accountId:'another-account'},now)).toBeNull();
  }
  expect(await listOfflineSaves(route.accountId)).toHaveLength(2);
});

it.each(['digest','asset'] as const)('rejects an altered V6 %s without replacing the previous saved revision',async reason=>{
  const epoch=await activateOfflineAccount(route.accountId);
  await commitOfflineSave(await stageOfflineSave(readerFixture(),route,fetchAsset,now),epoch,now);
  const changed=readerFixture('zh-Hant','v6');
  changed.document.revision=changed.access.revision=changed.access.currentRevision=2;
  if(reason==='digest')changed.document.content.layoutManifest.rendererArtifactSha256='0'.repeat(64);
  else changed.document.content.layoutManifest.assets[0].sha256='0'.repeat(64);
  await expect(stageOfflineSave(changed,route,fetchAsset,now)).rejects.toThrow('update_required');
  const saved=await readOfflineSave(route,now);
  expect(saved?.status).toBe('available');
  expect(saved?.save.value.access.revision).toBe(1);
  expect(saved?.save.value.document.content.layoutManifest.rendererVersion).toBe('v1');
});

it('does not retain partial resources or replace a saved revision when resource staging fails', async () => {
  const epoch = await activateOfflineAccount('account-a');
  await commitOfflineSave(await stageOfflineSave(readerFixture(), route, fetchAsset, now), epoch, now);
  const updated = readerFixture(); updated.document.revision = updated.access.revision = updated.access.currentRevision = 2;
  await expect(stageOfflineSave(updated, route, async () => new Response('corrupt'), now)).rejects.toThrow('invalid_offline_asset');
  expect((await readOfflineSave(route, now))?.save.value.access.revision).toBe(1);
});

it('blocks a second tab committing staged content after logout or switching accounts', async () => {
  const epoch = await activateOfflineAccount('account-a');
  const stage = await stageOfflineSave(readerFixture(), route, fetchAsset, now);
  await clearOfflineAccount('account-a');
  await expect(commitOfflineSave(stage, epoch, now)).rejects.toThrow('offline_account_changed');
  expect(await listOfflineSaves('account-a')).toEqual([]);
  const nextEpoch = await activateOfflineAccount('account-a');
  expect(nextEpoch).toBeGreaterThan(epoch);
  await activateOfflineAccount('account-b');
  await expect(commitOfflineSave(stage, nextEpoch, now)).rejects.toThrow('offline_account_changed');
  expect((await getOfflineIdentity())?.accountId).toBe('account-b');
});

it('purges all previous-account content on switch and never restores it by returning to that account', async () => {
  const epoch = await activateOfflineAccount('account-a');
  await commitOfflineSave(await stageOfflineSave(readerFixture(), route, fetchAsset, now), epoch, now);
  await activateOfflineAccount('account-b');
  await activateOfflineAccount('account-a');
  expect(await listOfflineSaves('account-a')).toEqual([]);
});

it('persists the observed clock high-water mark, and removal clears the edition', async () => {
  const epoch = await activateOfflineAccount('account-a');
  await commitOfflineSave(await stageOfflineSave(readerFixture(), route, fetchAsset, now), epoch, now);
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  await readOfflineSave(route, now + 1000);
  expect(put.mock.contexts.every(store => (store as IDBObjectStore).name !== 'documents')).toBe(true);
  put.mockRestore();
  expect((await readOfflineSave(route, now))?.status).toBe('revalidation_required');
  await removeOfflineSave(route);
  expect(await readOfflineSave(route, now)).toBeNull();
});

it('does not renew a save with a stale receipt or expose another account through listing', async () => {
  const epoch = await activateOfflineAccount('account-a');
  const staged = await stageOfflineSave(readerFixture(), route, fetchAsset, now);
  await expect(commitOfflineSave(staged, epoch, Date.parse(readerFixture().access.offlineValidUntil))).rejects.toThrow('offline_access_expired');
  expect(await listOfflineSaves('account-b')).toEqual([]);
});

it('locks on deployment drift and renews only the same saved document after fresh server validation', async () => {
  const epoch = await activateOfflineAccount('account-a');
  await commitOfflineSave(await stageOfflineSave(readerFixture(), route, fetchAsset, now), epoch, now);
  await lockOfflineSave(route);
  expect((await readOfflineSave(route, now))?.status).toBe('revalidation_required');
  const renewed = readerFixture();
  renewed.access.validatedAt = '2026-10-02T00:00:00Z'; renewed.access.offlineValidUntil = '2026-10-09T00:00:00Z';
  await renewOfflineSave(route, renewed, epoch, Date.parse(renewed.access.validatedAt));
  expect((await readOfflineSave(route, Date.parse(renewed.access.validatedAt)))?.status).toBe('available');
  await expect(renewOfflineSave(route, readerFixture(), epoch, now)).rejects.toThrow('offline_stale_receipt');
  const other = structuredClone(renewed); other.document.documentId = other.access.documentId = 'different';
  await expect(renewOfflineSave(route, other, epoch, Date.parse(renewed.access.validatedAt))).rejects.toThrow('invalid_reader_binding');
});

it('disables offline writes without required cross-tab locking', async () => {
  vi.stubGlobal('navigator', {});
  expect(supportsOfflineReader()).toBe(false);
  await expect(activateOfflineAccount('account-a')).rejects.toThrow('offline_unsupported');
});

it('bounds a behind-server clock to seven local days and never extends a repeated receipt', async () => {
  const value = readerFixture();
  const local = Date.parse(value.access.validatedAt) - 30000;
  const epoch = await activateOfflineAccount(route.accountId);
  const stage = await stageOfflineSave(value, route, fetchAsset, local);
  await commitOfflineSave(stage, epoch, local);
  expect((await readOfflineSave(route, local))?.status).toBe('available');
  await renewOfflineSave(route, value, epoch, local + 10000);
  await commitOfflineSave(await stageOfflineSave(value, route, fetchAsset, local + 10000), epoch, local + 10000);
  expect((await readOfflineSave(route, local + 604800000 - 1))?.status).toBe('available');
  expect((await readOfflineSave(route, local + 604800000))?.status).toBe('expired');
});
it('still purges existing private copies if locking support later becomes unavailable', async () => {
  const epoch = await activateOfflineAccount('account-a');
  await commitOfflineSave(await stageOfflineSave(readerFixture(), route, fetchAsset, now), epoch, now);
  vi.stubGlobal('navigator', {});
  await clearOfflineAccount('account-a');
  vi.stubGlobal('navigator', {locks: {request: async (_name: string, callback: () => Promise<unknown>) => callback()}});
  expect(await listOfflineSaves('account-a')).toEqual([]);
  expect((await getOfflineIdentity()).accountId).toBeNull();
});

it('rolls back the new document if the pointer write fails from storage quota', async () => {
  const epoch = await activateOfflineAccount('account-a');
  await commitOfflineSave(await stageOfflineSave(readerFixture(), route, fetchAsset, now), epoch, now);
  const newer = readerFixture(); newer.document.revision = newer.access.revision = newer.access.currentRevision = 2;
  const staged = await stageOfflineSave(newer, route, fetchAsset, now);
  const put = IDBObjectStore.prototype.put;
  const fail = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
    if (this.name === 'pointers') throw new DOMException('Storage full', 'QuotaExceededError');
    return put.apply(this, args);
  });
  await expect(commitOfflineSave(staged, epoch, now)).rejects.toMatchObject({name: 'QuotaExceededError'});
  fail.mockRestore();
  expect((await readOfflineSave(route, now))?.save.value.access.revision).toBe(1);
});
