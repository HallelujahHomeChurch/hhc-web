import type {OnlineBulletinAccess, BulletinReaderMutation, BulletinReaderMutationResponse} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from './api';
import {readerFailureAction} from './offline-access';
import {acknowledgePrivateMutation, bindOnlinePrivate, claimPrivateMutation, lockOfflineSave, readPrivateReplica, removeOfflineSave, seedPrivateReplica} from './offline-store';

export type ReaderSyncStatus = 'synced' | 'waiting' | 'syncing' | 'action' | 'paused';
/** One account writer where Web Locks are available; local acceptance never waits here. */
export function withReaderWriter<T>(accountId: string, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  const guarded = async () => {signal.throwIfAborted(); return work();};
  if (navigator.locks) return navigator.locks.request(`hhc-weekly-reader-sync:${accountId}`, {signal}, guarded);
  // shortcut: Older browsers serialize per tab with server IDs/CAS; remove when all supported browsers have Web Locks.
  return guarded();
}
export async function syncPrivateReplica(api: Pick<ReturnType<typeof createReaderApi>, 'renew' | 'privateState' | 'mutate'>, selector: ReaderSelector, value: OnlineBulletinAccess, epoch: number, signal: AbortSignal, now = Date.now, onResult?: (mutation: BulletinReaderMutation, result: BulletinReaderMutationResponse['results'][number]) => void) {
  // One foreground sync per account; edits still commit through IDB transactions.
  return withReaderWriter(selector.accountId, signal, async () => {
    try {
      signal.throwIfAborted();
      const fresh = await api.renew(selector, value, crypto.randomUUID(), signal);
      signal.throwIfAborted();
      await bindOnlinePrivate(selector, fresh, epoch, now());
      const cloud = await api.privateState(selector, fresh, signal);
      signal.throwIfAborted();
      if (cloud.state.currentRevision !== value.document.revision) return {status: 'paused' as const, replica: await readPrivateReplica(selector, now())};
      await seedPrivateReplica(selector, cloud.state, epoch, now());
      while (true) {
        signal.throwIfAborted();
        const next = await claimPrivateMutation(selector, epoch, now());
        if (!next) break;
        const response = await api.mutate(selector, fresh, [next.mutation], signal);
        signal.throwIfAborted();
        await acknowledgePrivateMutation(selector, response, epoch, now());
        signal.throwIfAborted(); onResult?.(next.mutation, response.results[0]);
        if (response.results[0].status !== 'applied' || response.state.currentRevision !== value.document.revision) break;
      }
      const replica = await readPrivateReplica(selector, now());
      return {status: replica?.queue.length ? 'action' as const : 'synced' as const, replica, bookmarksSupported: Array.isArray(cloud.state.bookmarks)};
    } catch (error) {
      if (!signal.aborted) {
        const action = readerFailureAction(error);
        if (action === 'purge') await removeOfflineSave(selector);
        if (action === 'lock') await lockOfflineSave(selector);
      }
      throw error;
    }
  });
}
