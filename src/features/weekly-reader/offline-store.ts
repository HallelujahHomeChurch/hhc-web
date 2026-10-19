import {getBulletinRendererCapabilities} from '@hallelujahhomechurch/ui';
import type {OnlineBulletinAccess, BulletinReaderMutation, BulletinReaderMutationResponse, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {verifyReaderAccess, type ReaderSelector} from './api';
import {evaluateOfflineAccess, localAccessDeadline} from './offline-access';
import {isBookmarkMutation} from './bookmarks';
import {applyLocalMutation, verifyPrivateState} from './private-state';
import {appendPrivateIntent, acknowledgePrivateIntent} from './private-journal';
import type {ReaderRecovery} from './rebase';
import {clearReaderReturn, clearReaderReturnIfUnchanged, readerReturnSnapshot, hasPendingReaderReturn} from './return-state';

type Identity = {accountId: string | null; epoch: number};
export type OfflineSave = {
  instanceId?: string;
  selector: ReaderSelector;
  value: OnlineBulletinAccess;
  resources: {url: string; bytes: ArrayBuffer; type: string}[];
  size: number;
  lastObservedAt: number;
  localValidUntil?: number;
  epoch: number;
  locked: boolean;
};
export type OfflineSaveSummary = {
  selector: ReaderSelector;
  documentId: string;
  revision: number;
  size: number;
  offlineValidUntil: string;
};
type OfflineCheck = Pick<OfflineSave, 'lastObservedAt' | 'localValidUntil' | 'epoch' | 'locked'> & {access: OnlineBulletinAccess['access']; onlineOnly?: boolean; instanceId?: string; contentHash?: string};
type MutationResult = BulletinReaderMutationResponse['results'][number];
export type PendingReaderMutation = {mutation: BulletinReaderMutation; sent: boolean; result?: MutationResult; replay?: BulletinReaderMutation; replayResult?: MutationResult; recoveryReason?: ReaderRecovery['reason']; resolution?: {mutation: BulletinReaderMutation | null; result?: MutationResult}};
export type PrivateReplica = {state: BulletinReaderState; confirmed: BulletinReaderState; queue: PendingReaderMutation[]};
const stores = ['identity', 'documents', 'pointers', 'checks', 'private'];
const offlineCheck = (save: OfflineSave): OfflineCheck => ({access: save.value.access, lastObservedAt: save.lastObservedAt, localValidUntil: save.localValidUntil, epoch: save.epoch, locked: save.locked});
const editionKey = (selector: ReaderSelector) => [selector.accountId, selector.issueNumber, selector.series, selector.contentLocale];
const documentKey = (save: OfflineSave) => [save.value.access.accountId, save.value.access.documentId, save.value.access.series, save.value.access.contentLocale, save.value.access.revision];
// Canonical content stays in memory; persisted online journals contain no publication.
const onlineBindings = new Map<string, {value: OnlineBulletinAccess; epoch: number; deadline: number; observed: number}>();
const onlineDocuments = new Map<string, OnlineBulletinAccess['document']>();
function forgetOnlineAccount(accountId: string) {
  for (const key of onlineBindings.keys()) if (JSON.parse(key)[0] === accountId) onlineBindings.delete(key);
  for (const key of onlineDocuments.keys()) if (JSON.parse(key)[0] === accountId) onlineDocuments.delete(key);
}
const editionEvent = 'hhc:weekly-reader-edition';
function notifyEdition(selector: ReaderSelector, updated = false) {
  if (typeof window === 'undefined') return;
  const key = JSON.stringify(editionKey(selector));
  const message = {key, updated};
  window.dispatchEvent(new CustomEvent(editionEvent, {detail: message}));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(editionEvent); channel.postMessage(message); channel.close();
  }
}
export function watchOfflineEdition(selector: ReaderSelector, invalidated: (updated?: boolean) => void) {
  const key = JSON.stringify(editionKey(selector));
  const changed = (message: unknown) => {
    if (message === key) invalidated(false);
    else if (message && typeof message === 'object' && 'key' in message && message.key === key) invalidated('updated' in message && message.updated === true);
  };
  const local = (event: Event) => changed((event as CustomEvent).detail);
  window.addEventListener(editionEvent, local);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(editionEvent);
  if (channel) channel.onmessage = event => changed(event.data);
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
  const opening = indexedDB.open('hhc-weekly-reader', 2);
  opening.onupgradeneeded = () => {for (const name of stores) if (!opening.result.objectStoreNames.contains(name)) opening.result.createObjectStore(name);};
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
  forgetOnlineAccount(accountId);
  for (const name of ['documents', 'pointers', 'checks', 'private']) {
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
  // V7/V8 Hans add 8.1 MB of pinned TC fallback fonts; retain the previous content headroom.
  const maxSize = (value.document.contentLocale === 'zh-Hans' && getBulletinRendererCapabilities(value.document.content.layoutManifest.rendererVersion).fontFamily === 'v7' ? 40 : 32) * 1024 * 1024;
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
        if (size + length > maxSize) throw new Error('offline_asset_too_large');
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
  return {selector: {...selector}, value: structuredClone(value), resources, size, epoch: -1, lastObservedAt: now, localValidUntil: localAccessDeadline(value.access, now), locked: false};
}

export async function commitOfflineSave(staged: OfflineSave, epoch: number, now = Date.now()) {
  if (!supportsOfflineReader()) throw new Error('offline_unsupported');
  return navigator.locks.request(`hhc-weekly-reader:${staged.selector.accountId}`, () => transaction('readwrite', async tx => {
    const current = await identity(tx);
    if (current.accountId !== staged.selector.accountId || current.epoch !== epoch) throw new Error('offline_account_changed');
    const save = {...staged, instanceId: crypto.randomUUID(), epoch, lastObservedAt: Math.max(now, staged.lastObservedAt)};
    if (accessStatus(offlineCheck(save), current, now) !== 'available') throw new Error('offline_access_expired');
    const key = documentKey(save);
    const pointer = await result(tx.objectStore('pointers').get(editionKey(staged.selector)));
    if (pointer && JSON.stringify(pointer) !== JSON.stringify(key)) {
      const previousReplica: PrivateReplica | undefined = await result(tx.objectStore('private').get(pointer));
      if (previousReplica?.queue.length) throw new Error('offline_pending_recovery');
    }
    const previous: OfflineCheck | undefined = await result(tx.objectStore('checks').get(key));
    if (previous && (Date.parse(previous.access.validatedAt) > Date.parse(save.value.access.validatedAt) || previous.locked && Date.parse(previous.access.validatedAt) >= Date.parse(save.value.access.validatedAt))) throw new Error('offline_stale_receipt');
    if (previous?.access.validatedAt === save.value.access.validatedAt) {
      save.localValidUntil = Math.min(save.localValidUntil ?? Date.parse(save.value.access.offlineValidUntil), previous.localValidUntil ?? Date.parse(previous.access.offlineValidUntil));
      save.lastObservedAt = Math.max(save.lastObservedAt, previous.lastObservedAt);
      if (accessStatus(offlineCheck(save), current, now) !== 'available') throw new Error('offline_access_expired');
    }
    tx.objectStore('documents').put(save, key);
    tx.objectStore('checks').put(offlineCheck(save), key);
    tx.objectStore('pointers').put(key, editionKey(save.selector));
  }));
}

function accessStatus(check: OfflineCheck, owner: Identity, now: number) {
  return evaluateOfflineAccess({binding: check.access, expected: {...check.access, accountId: owner.accountId ?? ''},
    validatedAt: Date.parse(check.access.validatedAt), offlineValidUntil: Date.parse(check.access.offlineValidUntil),
    localValidUntil: check.localValidUntil,
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
    save.lastObservedAt = check.lastObservedAt; save.localValidUntil = check.localValidUntil; save.locked = check.locked; save.epoch = check.epoch;
    return {save, status};
  });
}

export async function listOfflineSaves(accountId: string): Promise<OfflineSaveSummary[]> {
  return transaction('readonly', async tx => {
    if ((await identity(tx)).accountId !== accountId) return [];
    const pointers = await result(tx.objectStore('pointers').getAllKeys());
    const saved: OfflineSaveSummary[] = [];
    for (const key of pointers) {
      if (!Array.isArray(key) || key[0] !== accountId) continue;
      const target = await result(tx.objectStore('pointers').get(key));
      const save: OfflineSave | undefined = await result(tx.objectStore('documents').get(target));
      if (save) saved.push({selector: save.selector, documentId: save.value.document.documentId, revision: save.value.access.revision, size: save.size, offlineValidUntil: save.value.access.offlineValidUntil});
    }
    return saved;
  });
}

export async function lockOfflineSave(selector: ReaderSelector) {
  onlineBindings.delete(JSON.stringify(editionKey(selector)));
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
    const renewed = {...save, value, locked: false, lastObservedAt: validatedAt > previous ? now : Math.max(now, check.lastObservedAt),
      localValidUntil: validatedAt > previous ? localAccessDeadline(value.access, now) : check.localValidUntil};
    if (accessStatus(offlineCheck(renewed), owner, now) !== 'available') throw new Error('offline_access_expired');
    tx.objectStore('documents').put(renewed, key);
    tx.objectStore('checks').put(offlineCheck(renewed), key);
  });
}

export type OfflineRemovalSnapshot = {
  accountId: string; epoch: number; pointer: string; documentId: string; revision: number; instanceId: string;
  queues: string; returnValue: string | null; pending: boolean;
};
const sameDocument = (candidate: IDBValidKey, key: IDBValidKey[]) => Array.isArray(candidate) && candidate.slice(0, 4).length === 4 && candidate.slice(0, 4).every((part, i) => part === key[i]);

async function removalContext(tx: IDBTransaction, selector: ReaderSelector) {
  const owner = await identity(tx);
  if (owner.accountId !== selector.accountId) throw new Error('offline_account_changed');
  const key: IDBValidKey[] | undefined = await result(tx.objectStore('pointers').get(editionKey(selector)));
  if (!Array.isArray(key) || key[0] !== owner.accountId) throw new Error('offline_replica_changed');
  const documents = tx.objectStore('documents');
  const save: OfflineSave | undefined = await result(documents.get(key));
  if (!save || JSON.stringify(editionKey(save.selector)) !== JSON.stringify(editionKey(selector)) || JSON.stringify(documentKey(save)) !== JSON.stringify(key) || save.epoch !== owner.epoch) throw new Error('offline_replica_changed');
  if (!save.instanceId) {save.instanceId = crypto.randomUUID(); documents.put(save, key);}
  const privateStore = tx.objectStore('private');
  const keys = (await result(privateStore.getAllKeys())).filter(candidate => sameDocument(candidate, key));
  const queues = await Promise.all(keys.map(async candidate => [candidate, ((await result(privateStore.get(candidate))) as PrivateReplica).queue] as const));
  queues.sort((a, b) => JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])));
  return {accountId: owner.accountId, epoch: owner.epoch, pointer: JSON.stringify(key), documentId: String(key[1]), revision: save.value.access.revision, instanceId: save.instanceId, queues: JSON.stringify(queues), pending: queues.some(([, queue]) => queue.length > 0)};
}

export async function readOfflineRemovalSnapshot(selector: ReaderSelector): Promise<OfflineRemovalSnapshot> {
  return transaction('readwrite', async tx => {
    const snapshot = await removalContext(tx, selector);
    const pendingReturn = hasPendingReaderReturn(selector.accountId, snapshot.documentId);
    return {...snapshot, returnValue: readerReturnSnapshot(snapshot), pending: snapshot.pending || pendingReturn};
  });
}

export async function removeOfflineSave(selector: ReaderSelector, expected?: OfflineRemovalSnapshot) {
  if (expected && (expected.accountId !== selector.accountId || readerReturnSnapshot(expected) !== expected.returnValue)) throw new Error('offline_replica_changed');
  const documentId = await transaction('readwrite', async tx => {
    const pointer = tx.objectStore('pointers');
    const key = await result(pointer.get(editionKey(selector)));
    if (!key) {if (expected) throw new Error('offline_replica_changed'); return;}
    const owner = await identity(tx);
    if (owner.accountId !== selector.accountId) throw new Error('offline_account_changed');
    if (expected) {
      const actual = await removalContext(tx, selector);
      const fields = ['accountId', 'epoch', 'pointer', 'documentId', 'revision', 'instanceId', 'queues'] as const;
      if (fields.some(field => actual[field] !== expected[field]) || readerReturnSnapshot(expected) !== expected.returnValue) throw new Error('offline_replica_changed');
    }
    for (const name of ['documents', 'checks', 'private']) {
      const store = tx.objectStore(name);
      for (const candidate of await result(store.getAllKeys())) if (sameDocument(candidate, key)) store.delete(candidate);
    }
    pointer.delete(editionKey(selector));
    // sessionStorage cannot join IDB: check before commit, then retain any newer return.
    if (expected && readerReturnSnapshot(expected) !== expected.returnValue) throw new Error('offline_replica_changed');
    tx.commit();
    return String(key[1]);
  });
  onlineBindings.delete(JSON.stringify(editionKey(selector)));
  if (documentId) {
    for (const key of onlineDocuments.keys()) if (JSON.parse(key)[0] === selector.accountId && JSON.parse(key)[1] === documentId) onlineDocuments.delete(key);
    if (expected) clearReaderReturnIfUnchanged(expected, expected.returnValue);
    else clearReaderReturn({accountId: selector.accountId, documentId});
  }
  notifyEdition(selector);
}

/** Register only after fresh online authorization, never from an offline fallback. */
export async function bindOnlinePrivate(selector: ReaderSelector, value: OnlineBulletinAccess, epoch: number, now = Date.now()) {
  verifyReaderAccess(value, selector);
  const bindingKey = JSON.stringify(editionKey(selector));
  const previousRuntime = onlineBindings.get(bindingKey);
  const deadline = previousRuntime?.value.access.receiptId === value.access.receiptId
    ? Math.min(previousRuntime.deadline, localAccessDeadline(value.access, now)) : localAccessDeadline(value.access, now);
  if (now >= deadline || previousRuntime && now < previousRuntime.observed) throw new Error('offline_access_expired');
  await renewOfflineSave(selector, value, epoch, now);
  await privateTransaction(async tx => {
    const owner = await identity(tx);
    if (owner.accountId !== selector.accountId || owner.epoch !== epoch) throw new Error('offline_account_changed');
    const key = [selector.accountId, value.document.documentId, selector.series, selector.contentLocale, value.document.revision];
    const pointer = await result(tx.objectStore('pointers').get(editionKey(selector)));
    if (pointer && JSON.stringify(pointer) !== JSON.stringify(key)) {
      const old: PrivateReplica | undefined = await result(tx.objectStore('private').get(pointer));
      // Fresh current access may reveal old private intents for explicit recovery;
      // it must not advance their pointer or automatically replay old anchors.
      if (old?.queue.length) return;
    }
    if (await result(tx.objectStore('documents').get(key))) return;
    const previous: OfflineCheck | undefined = await result(tx.objectStore('checks').get(key));
    const validated = Date.parse(value.access.validatedAt), prior = previous ? Date.parse(previous.access.validatedAt) : -Infinity;
    if (validated < prior || previous?.locked && validated <= prior) throw new Error('offline_stale_receipt');
    if (previous?.contentHash && previous.contentHash !== value.document.content.layoutManifest.contentHash) throw new Error('invalid_reader_binding');
    const check: OfflineCheck = {access: structuredClone(value.access), epoch, locked: false, onlineOnly: true,
      instanceId: previous?.instanceId ?? crypto.randomUUID(), contentHash: value.document.content.layoutManifest.contentHash,
      lastObservedAt: Math.max(now, previous?.lastObservedAt ?? now), localValidUntil: validated === prior ? Math.min(deadline, previous?.localValidUntil ?? deadline) : deadline};
    if (accessStatus(check, owner, now) !== 'available') throw new Error('offline_access_expired');
    tx.objectStore('checks').put(check, key); tx.objectStore('pointers').put(key, editionKey(selector));
  });
  onlineBindings.set(bindingKey, {value, epoch, deadline, observed: now});
  while (onlineBindings.size > 8) onlineBindings.delete(onlineBindings.keys().next().value!);
  const key = JSON.stringify([selector.accountId, value.document.documentId, selector.series, selector.contentLocale, value.document.revision]);
  onlineDocuments.set(key, value.document);
  while (onlineDocuments.size > 8) onlineDocuments.delete(onlineDocuments.keys().next().value!);
}

type PrivateDocumentContext = {access: OnlineBulletinAccess['access']; document?: OnlineBulletinAccess['document']; epoch: number; instanceId?: string; onlineOnly: boolean; writable: boolean};
function privateDocument(context: PrivateDocumentContext) {
  if (!context.writable || !context.document) throw new Error('online_revalidation_required');
  return context.document;
}
async function privateContext(tx: IDBTransaction, selector: ReaderSelector, epoch: number | undefined, now: number) {
  const owner = await identity(tx);
  if (owner.accountId !== selector.accountId || epoch !== undefined && owner.epoch !== epoch) throw new Error('offline_account_changed');
  const checked = await checkAccess(tx, selector, now);
  if (!checked) throw new Error('offline_access_expired');
  const stored: OfflineSave | undefined = await result(tx.objectStore('documents').get(checked.key));
  const live = onlineBindings.get(JSON.stringify(editionKey(selector)));
  const fresh = !!live && live.epoch === owner.epoch && live.value.access.accountId === selector.accountId && live.value.access.documentId === checked.check.access.documentId && now >= live.observed && now < live.deadline;
  const recoveryOnly = checked.check.onlineOnly && fresh && live.value.document.revision > checked.check.access.revision;
  if (checked.status !== 'available' && !recoveryOnly) throw new Error('offline_access_expired');
  if (checked.check.onlineOnly && !fresh) throw new Error('online_revalidation_required');
  if (!stored && !checked.check.onlineOnly) throw new Error('invalid_reader_binding');
  const document = stored?.value.document ?? onlineDocuments.get(JSON.stringify(checked.key));
  if (stored && (stored.value.access.documentId !== checked.check.access.documentId || stored.value.access.revision !== checked.check.access.revision) || document && document.content.layoutManifest.contentHash !== checked.check.contentHash && checked.check.onlineOnly) throw new Error('invalid_reader_binding');
  const context: PrivateDocumentContext = {access: checked.check.access, document, epoch: owner.epoch,
    instanceId: stored?.instanceId ?? checked.check.instanceId, onlineOnly: !!checked.check.onlineOnly,
    writable: checked.status === 'available' && (!checked.check.onlineOnly || fresh && live.value.document.revision === checked.check.access.revision)};
  const replica: PrivateReplica | undefined = await result(tx.objectStore('private').get(checked.key));
  if (replica) verifyPrivateState(replica.state, selector.accountId, context.access.documentId, context.access.revision);
  return {key: checked.key, context, replica};
}

export async function readPrivateBinding(selector: ReaderSelector, now = Date.now()) {
  return privateTransaction(async tx => {
    const {context, replica} = await privateContext(tx, selector, undefined, now);
    return {revision: context.access.revision, epoch: context.epoch, onlineOnly: context.onlineOnly, writable: context.writable, replica};
  });
}

async function privateTransaction<T>(run: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const outcome = await transaction('readwrite', async tx => {
    try {return {value: await run(tx)};}
    catch (error) {
      // checkAccess writes the rollback lock. Commit that denial, not the action.
      if (error instanceof Error && error.message === 'offline_access_expired') return {denied: true};
      throw error;
    }
  });
  if ('denied' in outcome) throw new Error('offline_access_expired');
  return outcome.value;
}

function retainNewerBookmarks(current: BulletinReaderState['bookmarks'], incoming: BulletinReaderState['bookmarks']) {
  if (incoming === undefined) return current;
  const merged = new Map((current ?? []).map(bookmark => [bookmark.id, bookmark]));
  for (const bookmark of incoming) if ((merged.get(bookmark.id)?.version ?? 0) <= bookmark.version) merged.set(bookmark.id, bookmark);
  return [...merged.values()];
}

export type BookmarkCacheBinding = {epoch: number; instanceId: string; documentId: string; revision: number};
export async function readBookmarkCache(selector: ReaderSelector) {
  return privateTransaction(async tx => {
    const pointer = await result(tx.objectStore('pointers').get(editionKey(selector)));
    if (!pointer) return null;
    const {context, replica} = await privateContext(tx, selector, undefined, Date.now());
    if (!context.instanceId || !replica) throw new Error('private_state_unavailable');
    verifyPrivateState(replica.confirmed, selector.accountId, context.access.documentId, context.access.revision);
    return {binding: {epoch: context.epoch, instanceId: context.instanceId, documentId: context.access.documentId, revision: context.access.revision}, pending: replica.queue.length > 0};
  });
}

export async function mergeBookmarkCache(selector: ReaderSelector, expected: BookmarkCacheBinding, cloud: BulletinReaderState) {
  return privateTransaction(async tx => {
    const {key, context, replica} = await privateContext(tx, selector, expected.epoch, Date.now());
    if (!replica || context.instanceId !== expected.instanceId || context.access.documentId !== expected.documentId || context.access.revision !== expected.revision) throw new Error('offline_replica_changed');
    verifyPrivateState(cloud, selector.accountId, expected.documentId, expected.revision);
    if (cloud.currentRevision !== expected.revision || !cloud.bookmarks) throw new Error('invalid_reader_binding');
    // A second tab may already have a newer acknowledgement or a newly queued note.
    const bookmarks = retainNewerBookmarks(replica.confirmed.bookmarks, cloud.bookmarks);
    const next = {...replica, state: {...replica.state, bookmarks}, confirmed: {...replica.confirmed, bookmarks}};
    tx.objectStore('private').put(next, key);
    return next;
  });
}

export type ReaderExportLocal = {state: BulletinReaderState; queue: PendingReaderMutation[]; fingerprint: string};

/** A single IDB transaction binds the complete replica to its saved instance and receipt. */
export async function readReaderExportLocal(selector: ReaderSelector, documentId: string, revision: number, now = Date.now()): Promise<ReaderExportLocal | null> {
  return privateTransaction(async tx => {
    const pointer = await result(tx.objectStore('pointers').get(editionKey(selector)));
    if (!pointer) return null;
    const owner = await identity(tx);
    const {key, context, replica} = await privateContext(tx, selector, undefined, now);
    if (!context.instanceId || !replica || context.access.documentId !== documentId || context.access.revision !== revision || context.epoch !== owner.epoch) throw new Error('export_unavailable');
    verifyPrivateState(replica.confirmed, selector.accountId, documentId, revision);
    if (replica.state.currentRevision !== revision || replica.confirmed.currentRevision !== revision) throw new Error('export_unavailable');
    if (replica.queue.some(entry => entry.sent !== false || entry.result !== undefined || entry.replay !== undefined || entry.replayResult !== undefined || entry.resolution !== undefined || entry.recoveryReason !== undefined)) throw new Error('export_unavailable');
    let projected = replica.confirmed;
    for (const entry of replica.queue) projected = applyLocalMutation(projected, entry.mutation, privateDocument(context));
    if (JSON.stringify(projected) !== JSON.stringify(replica.state)) throw new Error('export_unavailable');
    return {state: replica.state, queue: replica.queue, fingerprint: JSON.stringify([owner, key, context.instanceId, context.access, replica])};
  });
}

export async function readPrivateReplica(selector: ReaderSelector, now = Date.now()): Promise<PrivateReplica | null> {
  return privateTransaction(async tx => (await privateContext(tx, selector, undefined, now)).replica ?? null);
}

export async function seedPrivateReplica(selector: ReaderSelector, state: BulletinReaderState, epoch: number, now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, context, replica} = await privateContext(tx, selector, epoch, now);
    verifyPrivateState(state, selector.accountId, context.access.documentId, context.access.revision);
    if (state.currentRevision !== context.access.revision) throw new Error('revision_changed');
    // Pending operations must be replayed against the server before replacing their base.
    if (replica?.queue.length) return replica;
    const bookmarks = retainNewerBookmarks(replica?.confirmed.bookmarks, state.bookmarks);
    const retained = bookmarks === undefined ? state : {...state, bookmarks};
    const next: PrivateReplica = {state: retained, confirmed: retained, queue: []};
    tx.objectStore('private').put(next, key);
    return next;
  });
}

export async function enqueuePrivateMutation(selector: ReaderSelector, mutation: BulletinReaderMutation, epoch: number, now = Date.now()) {
  if (isBookmarkMutation(mutation)) throw new Error('bookmark_online_only');
  return privateTransaction(async tx => {
    const {key, context, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica) throw new Error('private_state_unavailable');
    const next = appendPrivateIntent(replica, mutation, privateDocument(context));
    tx.objectStore('private').put(next, key);
    return next;
  });
}

export async function claimPrivateMutation(selector: ReaderSelector, epoch: number, now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, context, replica} = await privateContext(tx, selector, epoch, now);
    if (!context.writable) return null;
    const first = replica?.queue[0];
    if (!replica || !first || first.result || first.replay || first.resolution || first.recoveryReason) return null;
    if (!Number.isFinite(Date.parse(first.mutation.createdAt)) || now - Date.parse(first.mutation.createdAt) > 90 * 86400000) {
      first.result = {mutationId: first.mutation.mutationId, status: 'recovery_required', revision: replica.state.currentRevision};
      tx.objectStore('private').put(replica, key);
      return null;
    }
    first.sent = true;
    tx.objectStore('private').put(replica, key);
    return first;
  });
}

export async function acknowledgePrivateMutation(selector: ReaderSelector, response: BulletinReaderMutationResponse, epoch: number, now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, context, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica) throw new Error('private_state_unavailable');
    const next = acknowledgePrivateIntent(replica, response, privateDocument(context));
    tx.objectStore('private').put(next, key);
    return next;
  });
}

export async function hasPendingReaderWrites(accountId: string, documentId?: string) {
  if (hasPendingReaderReturn(accountId, documentId)) return true;
  if (typeof indexedDB === 'undefined') return false;
  return transaction('readonly', async tx => {
    if ((await identity(tx)).accountId !== accountId) return false;
    const store = tx.objectStore('private');
    for (const key of await result(store.getAllKeys())) {
      if (Array.isArray(key) && key[0] === accountId && (!documentId || key[1] === documentId) && ((await result(store.get(key))) as PrivateReplica).queue.length) return true;
    }
    return false;
  });
}

export async function commitOfflineUpgrade(staged: OfflineSave, state: BulletinReaderState, epoch: number, previousRevision: number, expectedQueue: readonly PendingReaderMutation[], now = Date.now()) {
  verifyReaderAccess(staged.value, staged.selector);
  verifyPrivateState(state, staged.selector.accountId, staged.value.document.documentId, staged.value.document.revision);
  if (state.currentRevision !== staged.value.document.revision || state.conflicts.length) throw new Error('upgrade_incomplete');
  await privateTransaction(async tx => {
    const {key: oldKey, context: previous, replica} = await privateContext(tx, staged.selector, epoch, now);
    if (previous.access.documentId !== state.documentId || previous.access.revision !== previousRevision || staged.value.access.revision < previousRevision || JSON.stringify(replica?.queue ?? []) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    if (replica?.queue.some(entry => entry.resolution ? entry.resolution.mutation && entry.resolution.result?.status !== 'applied' : (entry.replayResult ?? entry.result)?.status !== 'applied')) throw new Error('upgrade_incomplete');
    const save = {...staged, instanceId: crypto.randomUUID(), epoch, lastObservedAt: now};
    if (accessStatus(offlineCheck(save), await identity(tx), now) !== 'available') throw new Error('offline_access_expired');
    const key = documentKey(save);
    tx.objectStore('documents').put(save, key);
    tx.objectStore('checks').put(offlineCheck(save), key);
    tx.objectStore('private').put({state, confirmed: state, queue: []} satisfies PrivateReplica, key);
    tx.objectStore('pointers').put(key, editionKey(staged.selector));
    if (previousRevision !== staged.value.access.revision) {tx.objectStore('documents').delete(oldKey); tx.objectStore('checks').delete(oldKey); tx.objectStore('private').delete(oldKey);}
  });
  notifyEdition(staged.selector, true);
}

/** Commit private recovery without downloading or manufacturing an offline publication. */
export async function commitOnlineUpgrade(selector: ReaderSelector, value: OnlineBulletinAccess, state: BulletinReaderState, epoch: number, previousRevision: number, expectedQueue: readonly PendingReaderMutation[], now = Date.now()) {
  verifyReaderAccess(value, selector);
  verifyPrivateState(state, selector.accountId, value.document.documentId, value.document.revision);
  if (state.currentRevision !== value.document.revision || state.conflicts.length) throw new Error('upgrade_incomplete');
  await privateTransaction(async tx => {
    const {key: oldKey, context, replica} = await privateContext(tx, selector, epoch, now);
    if (!context.onlineOnly || context.access.documentId !== state.documentId || context.access.revision !== previousRevision || value.document.revision < previousRevision || JSON.stringify(replica?.queue ?? []) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    if (replica?.queue.some(entry => entry.resolution ? entry.resolution.mutation && entry.resolution.result?.status !== 'applied' : (entry.replayResult ?? entry.result)?.status !== 'applied')) throw new Error('upgrade_incomplete');
    const check: OfflineCheck = {access: structuredClone(value.access), epoch, locked: false, onlineOnly: true,
      instanceId: crypto.randomUUID(), contentHash: value.document.content.layoutManifest.contentHash,
      lastObservedAt: now, localValidUntil: localAccessDeadline(value.access, now)};
    if (accessStatus(check, await identity(tx), now) !== 'available') throw new Error('offline_access_expired');
    const key = [selector.accountId, state.documentId, selector.series, selector.contentLocale, value.document.revision];
    tx.objectStore('checks').put(check, key);
    tx.objectStore('private').put({state, confirmed: state, queue: []} satisfies PrivateReplica, key);
    tx.objectStore('pointers').put(key, editionKey(selector));
    if (previousRevision !== value.document.revision) {tx.objectStore('checks').delete(oldKey); tx.objectStore('private').delete(oldKey);}
  });
  await bindOnlinePrivate(selector, value, epoch, now);
  notifyEdition(selector, true);
}

export async function stageReaderReplay(selector: ReaderSelector, originalId: string, replay: BulletinReaderMutation, epoch: number, now = Date.now(), expectedQueue?: readonly PendingReaderMutation[]) {
  return privateTransaction(async tx => {
    const {key, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica || expectedQueue && JSON.stringify(replica.queue) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    const entry = replica.queue.find(entry => entry.mutation.mutationId === originalId);
    if (!entry || replay.mutationId !== originalId || replay.createdAt !== entry.mutation.createdAt) throw new Error('invalid_reader_binding');
    if (entry.replay && JSON.stringify(entry.replay) !== JSON.stringify(replay) && entry.replayResult?.status !== 'revision_changed') throw new Error('replay_requires_resolution');
    entry.replay = replay; entry.replayResult = undefined;
    tx.objectStore('private').put(replica, key);
    return replica.queue;
  });
}

export async function recordReaderReplayResult(selector: ReaderSelector, resultValue: BulletinReaderMutationResponse['results'][number], epoch: number, expectedQueue: readonly PendingReaderMutation[], now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica || JSON.stringify(replica.queue) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    const entry = replica.queue.find(entry => entry.replay?.mutationId === resultValue.mutationId);
    if (!entry) throw new Error('invalid_reader_binding');
    entry.replayResult = resultValue;
    tx.objectStore('private').put(replica, key);
    return replica.queue;
  });
}

/** Explicit user decision; keep the original payload until the whole recovery commits. */
export async function chooseReaderRecovery(selector: ReaderSelector, originalId: string | null, mutation: BulletinReaderMutation | null, epoch: number, expectedQueue: readonly PendingReaderMutation[], now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica || JSON.stringify(replica.queue) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    if (mutation && replica.queue.some(entry => entry.mutation.mutationId === mutation.mutationId || entry.resolution?.mutation?.mutationId === mutation.mutationId)) throw new Error('mutation_id_conflict');
    if (originalId) {
      const entry = replica.queue.find(entry => entry.mutation.mutationId === originalId);
      if (!entry || entry.resolution?.mutation && !entry.resolution.result) throw new Error('replay_requires_resolution');
      entry.resolution = {mutation};
    } else {
      if (mutation?.kind !== 'resolveHighlightMigrationConflict') throw new Error('invalid_reader_binding');
      replica.queue.push({mutation, sent: false});
    }
    tx.objectStore('private').put(replica, key);
    return replica.queue;
  });
}

export async function recordReaderRecoveryResult(selector: ReaderSelector, resultValue: MutationResult, epoch: number, expectedQueue: readonly PendingReaderMutation[], now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica || JSON.stringify(replica.queue) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    const entry = replica.queue.find(entry => entry.resolution?.mutation?.mutationId === resultValue.mutationId);
    if (!entry?.resolution) throw new Error('invalid_reader_binding');
    entry.resolution.result = resultValue;
    tx.objectStore('private').put(replica, key);
    return replica.queue;
  });
}

export async function retainReaderRecoveries(selector: ReaderSelector, recovery: readonly ReaderRecovery[], epoch: number, expectedQueue: readonly PendingReaderMutation[], now = Date.now()) {
  return privateTransaction(async tx => {
    const {key, replica} = await privateContext(tx, selector, epoch, now);
    if (!replica || JSON.stringify(replica.queue) !== JSON.stringify(expectedQueue)) throw new Error('offline_replica_changed');
    for (const item of recovery) {
      const entry = replica.queue.find(entry => entry.mutation.mutationId === item.mutationId);
      if (!entry) throw new Error('invalid_reader_binding');
      entry.recoveryReason = item.reason;
    }
    tx.objectStore('private').put(replica, key);
    return replica.queue;
  });
}
