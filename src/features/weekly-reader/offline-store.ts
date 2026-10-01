import type {OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {verifyReaderAccess, type ReaderSelector} from './api';
import {evaluateOfflineAccess} from './offline-access';

type Identity = {accountId: string | null; epoch: number};
export type OfflineSave = {
  selector: ReaderSelector;
  value: OnlineBulletinAccess;
  resources: {url: string; bytes: ArrayBuffer; type: string}[];
  size: number;
  lastObservedAt: number;
  epoch: number;
  locked: boolean;
};
type OfflineCheck = Pick<OfflineSave, 'lastObservedAt' | 'epoch' | 'locked'> & {access: OnlineBulletinAccess['access']};
const stores = ['identity', 'documents', 'pointers', 'checks'];
const offlineCheck = (save: OfflineSave): OfflineCheck => ({access: save.value.access, lastObservedAt: save.lastObservedAt, epoch: save.epoch, locked: save.locked});
const editionKey = (selector: ReaderSelector) => [selector.accountId, selector.issueNumber, selector.series, selector.contentLocale];
const documentKey = (save: OfflineSave) => [save.value.access.accountId, save.value.access.documentId, save.value.access.series, save.value.access.contentLocale, save.value.access.revision];
const editionEvent = 'hhc:weekly-reader-edition';
function notifyEdition(selector: ReaderSelector) {
  if (typeof window === 'undefined') return;
  const key = JSON.stringify(editionKey(selector));
  window.dispatchEvent(new CustomEvent(editionEvent, {detail: key}));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(editionEvent); channel.postMessage(key); channel.close();
  }
}
export function watchOfflineEdition(selector: ReaderSelector, invalidated: () => void) {
  const key = JSON.stringify(editionKey(selector));
  const local = (event: Event) => {if ((event as CustomEvent).detail === key) invalidated();};
  window.addEventListener(editionEvent, local);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(editionEvent);
  if (channel) channel.onmessage = event => {if (event.data === key) invalidated();};
  return () => {window.removeEventListener(editionEvent, local); channel?.close();};
}

export function supportsOfflineReader() {
  return typeof indexedDB !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.locks && !!globalThis.crypto?.subtle;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
}

async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  if (typeof indexedDB === 'undefined') throw new Error('offline_unsupported');
  const opening = indexedDB.open('hhc-weekly-reader', 1);
  opening.onupgradeneeded = () => {for (const name of stores) opening.result.createObjectStore(name);};
  const db = await result(opening);
  db.onversionchange = () => db.close();
  const tx = db.transaction(stores, mode);
  const completion = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('offline_transaction_aborted'));
    tx.onerror = () => {}; // onabort owns the single transaction failure.
  });
  // Attach immediately: a rejected request can abort before the callback unwinds.
  void completion.catch(() => {});
  try {
    const value = await run(tx);
    await completion;
    return value;
  } catch (error) {
    try {tx.abort();} catch { /* Already completed or aborted. */ }
    await completion.catch(() => {});
    throw error;
  } finally {db.close();}
}

async function identity(tx: IDBTransaction): Promise<Identity> {
  return await result(tx.objectStore('identity').get('active')) ?? {accountId: null, epoch: 0};
}

async function purgeAccount(tx: IDBTransaction, accountId: string) {
  for (const name of ['documents', 'pointers', 'checks']) {
    const store = tx.objectStore(name);
    const keys = await result(store.getAllKeys());
    for (const key of keys) if (Array.isArray(key) && key[0] === accountId) store.delete(key);
  }
}

export async function getOfflineIdentity() {return transaction('readonly', identity);}

// Call only after the shared account runtime establishes a successful identity.
// IDB serializes the identity change and purge with every save commit across tabs.
export async function activateOfflineAccount(accountId: string) {
  if (!supportsOfflineReader()) throw new Error('offline_unsupported');
  if (!accountId) throw new Error('offline_invalid_account');
  return transaction('readwrite', async tx => {
    const current = await identity(tx);
    if (current.accountId === accountId) return current.epoch;
    if (current.accountId) await purgeAccount(tx, current.accountId);
    const next = {accountId, epoch: current.epoch + 1};
    tx.objectStore('identity').put(next, 'active');
    return next.epoch;
  });
}

export async function clearOfflineAccount(accountId: string) {
  if (typeof indexedDB === 'undefined') return;
  return transaction('readwrite', async tx => {
    const current = await identity(tx);
    await purgeAccount(tx, accountId);
    if (current.accountId === accountId) tx.objectStore('identity').put({accountId: null, epoch: current.epoch + 1}, 'active');
  });
}

export async function stageOfflineSave(value: OnlineBulletinAccess, selector: ReaderSelector, fetcher = globalThis.fetch.bind(globalThis), now = Date.now(), signal?: AbortSignal): Promise<OfflineSave> {
  verifyReaderAccess(value, selector);
  const resources: OfflineSave['resources'] = [];
  let size = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  for (const asset of value.document.content.layoutManifest.assets) {
    signal?.throwIfAborted();
    // verifyReaderAccess restricts these to exact code-owned public URLs/digests.
    const response = await fetcher(asset.url, {credentials: 'omit', cache: 'no-store', redirect: 'error', signal});
    if (!response.ok || !response.body) throw new Error('invalid_offline_asset');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const {done, value: chunk} = await reader.read();
        if (done) break;
        length += chunk.byteLength;
        if (size + length > 32 * 1024 * 1024) throw new Error('offline_asset_too_large');
        chunks.push(chunk);
      }
    } finally {await reader.cancel().catch(() => {}); reader.releaseLock();}
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== asset.sha256) throw new Error('invalid_offline_asset');
    resources.push({url: asset.url, bytes: bytes.buffer, type: response.headers.get('content-type') ?? 'application/octet-stream'});
    size += length;
  }
  signal?.throwIfAborted();
  return {selector: {...selector}, value: structuredClone(value), resources, size, epoch: -1, lastObservedAt: now, locked: false};
}

export async function commitOfflineSave(staged: OfflineSave, epoch: number, now = Date.now()) {
  if (!supportsOfflineReader()) throw new Error('offline_unsupported');
  return navigator.locks.request(`hhc-weekly-reader:${staged.selector.accountId}`, () => transaction('readwrite', async tx => {
    const current = await identity(tx);
    if (current.accountId !== staged.selector.accountId || current.epoch !== epoch) throw new Error('offline_account_changed');
    const save = {...staged, epoch, lastObservedAt: Math.max(now, staged.lastObservedAt)};
    if (accessStatus(offlineCheck(save), current, now) !== 'available') throw new Error('offline_access_expired');
    const key = documentKey(save);
    const previous: OfflineCheck | undefined = await result(tx.objectStore('checks').get(key));
    if (previous && (Date.parse(previous.access.validatedAt) > Date.parse(save.value.access.validatedAt) || previous.locked && Date.parse(previous.access.validatedAt) >= Date.parse(save.value.access.validatedAt))) throw new Error('offline_stale_receipt');
    tx.objectStore('documents').put(save, key);
    tx.objectStore('checks').put(offlineCheck(save), key);
    tx.objectStore('pointers').put(key, editionKey(save.selector));
  }));
}

function accessStatus(check: OfflineCheck, owner: Identity, now: number) {
  return evaluateOfflineAccess({binding: check.access, expected: {...check.access, accountId: owner.accountId ?? ''},
    validatedAt: Date.parse(check.access.validatedAt), offlineValidUntil: Date.parse(check.access.offlineValidUntil),
    now, lastObservedAt: check.lastObservedAt, logoutEpoch: check.epoch, currentLogoutEpoch: owner.epoch, locked: check.locked});
}

async function checkAccess(tx: IDBTransaction, selector: ReaderSelector, now: number, revision?: number) {
  const owner = await identity(tx);
  if (owner.accountId !== selector.accountId) return null;
  const key = await result(tx.objectStore('pointers').get(editionKey(selector)));
  if (!key) return null;
  const check: OfflineCheck | undefined = await result(tx.objectStore('checks').get(key));
  if (!check || revision !== undefined && check.access.revision !== revision) return null;
  if (check.access.accountId !== selector.accountId || check.access.series !== selector.series || check.access.contentLocale !== selector.contentLocale ||
      key[0] !== check.access.accountId || key[1] !== check.access.documentId || key[2] !== check.access.series || key[3] !== check.access.contentLocale || key[4] !== check.access.revision) return null;
  const status = accessStatus(check, owner, now);
  check.lastObservedAt = Math.max(now, check.lastObservedAt);
  if (status === 'revalidation_required') check.locked = true;
  tx.objectStore('checks').put(check, key);
  return {key, check, status};
}

export async function checkOfflineSave(selector: ReaderSelector, revision: number, now = Date.now()) {
  return transaction('readwrite', async tx => (await checkAccess(tx, selector, now, revision))?.status ?? 'unavailable');
}

export async function readOfflineSave(selector: ReaderSelector, now = Date.now()) {
  return transaction('readwrite', async tx => {
    const checked = await checkAccess(tx, selector, now);
    if (!checked) return null;
    const {key, check, status} = checked;
    const save: OfflineSave | undefined = await result(tx.objectStore('documents').get(key));
    if (!save) return null;
    if (JSON.stringify(editionKey(save.selector)) !== JSON.stringify(editionKey(selector)) || save.value.access.documentId !== check.access.documentId || save.value.access.revision !== check.access.revision) return null;
    save.lastObservedAt = check.lastObservedAt; save.locked = check.locked; save.epoch = check.epoch;
    return {save, status};
  });
}

export async function listOfflineSaves(accountId: string): Promise<OfflineSave[]> {
  return transaction('readonly', async tx => {
    if ((await identity(tx)).accountId !== accountId) return [];
    const pointers = await result(tx.objectStore('pointers').getAllKeys());
    const saved: OfflineSave[] = [];
    for (const key of pointers) {
      if (!Array.isArray(key) || key[0] !== accountId) continue;
      const target = await result(tx.objectStore('pointers').get(key));
      const save = await result(tx.objectStore('documents').get(target));
      if (save) saved.push(save);
    }
    return saved;
  });
}

export async function lockOfflineSave(selector: ReaderSelector) {
  await transaction('readwrite', async tx => {
    const key = await result(tx.objectStore('pointers').get(editionKey(selector)));
    if (!key) return;
    const check: OfflineCheck | undefined = await result(tx.objectStore('checks').get(key));
    if (check) tx.objectStore('checks').put({...check, locked: true}, key);
  });
  notifyEdition(selector);
}

export async function renewOfflineSave(selector: ReaderSelector, value: OnlineBulletinAccess, epoch: number, now = Date.now()) {
  verifyReaderAccess(value, selector);
  return transaction('readwrite', async tx => {
    const owner = await identity(tx);
    if (owner.accountId !== selector.accountId || owner.epoch !== epoch) throw new Error('offline_account_changed');
    const key = await result(tx.objectStore('pointers').get(editionKey(selector)));
    if (!key) return;
    const save: OfflineSave | undefined = await result(tx.objectStore('documents').get(key));
    const check: OfflineCheck | undefined = await result(tx.objectStore('checks').get(key));
    if (!save || !check) return;
    if (save.value.document.issueId !== value.document.issueId || save.value.access.documentId !== value.access.documentId || save.value.access.revision !== value.access.revision ||
        save.value.document.content.layoutManifest.contentHash !== value.document.content.layoutManifest.contentHash) throw new Error('invalid_reader_binding');
    const validatedAt = Date.parse(value.access.validatedAt);
    const previous = Date.parse(save.value.access.validatedAt);
    if (validatedAt < previous || check.locked && validatedAt <= previous) throw new Error('offline_stale_receipt');
    const renewed = {...save, value, locked: false, lastObservedAt: validatedAt > previous ? now : Math.max(now, check.lastObservedAt)};
    if (accessStatus(offlineCheck(renewed), owner, now) !== 'available') throw new Error('offline_access_expired');
    tx.objectStore('documents').put(renewed, key);
    tx.objectStore('checks').put(offlineCheck(renewed), key);
  });
}

export async function removeOfflineSave(selector: ReaderSelector) {
  await transaction('readwrite', async tx => {
    const pointer = tx.objectStore('pointers');
    const key = await result(pointer.get(editionKey(selector)));
    if (!key) return;
    const keys = await result(tx.objectStore('documents').getAllKeys());
    for (const candidate of keys) if (Array.isArray(candidate) && candidate.slice(0, 4).every((part, i) => part === key[i])) {
      tx.objectStore('documents').delete(candidate); tx.objectStore('checks').delete(candidate);
    }
    pointer.delete(editionKey(selector));
  });
  notifyEdition(selector);
}
