import type {OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from './api';
import {readerFailureAction} from './offline-access';
import {acknowledgePrivateMutation, claimPrivateMutation, lockOfflineSave, readPrivateReplica, removeOfflineSave, renewOfflineSave, seedPrivateReplica} from './offline-store';

export type ReaderSyncStatus = 'synced' | 'waiting' | 'syncing' | 'action' | 'paused';
export async function syncPrivateReplica(api: Pick<ReturnType<typeof createReaderApi>, 'renew' | 'privateState' | 'mutate'>, selector: ReaderSelector, value: OnlineBulletinAccess, epoch: number, signal: AbortSignal, now = Date.now) {
  // One foreground sync per account; edits still commit through IDB transactions.
  return navigator.locks.request(`hhc-weekly-reader-sync:${selector.accountId}`, {signal}, async () => {
    try {
      signal.throwIfAborted();
      const fresh = await api.renew(selector, value, crypto.randomUUID(), signal);
      signal.throwIfAborted();
      await renewOfflineSave(selector, fresh, epoch, now());
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
        if (response.results[0].status !== 'applied' || response.state.currentRevision !== value.document.revision) break;
      }
      const replica = await readPrivateReplica(selector, now());
      return {status: replica?.queue.length ? 'action' as const : 'synced' as const, replica};
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
