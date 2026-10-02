import type {BulletinReaderMutation, BulletinReaderState, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from './api';
import {commitOfflineUpgrade, getOfflineIdentity, readPrivateReplica, recordReaderReplayResult, recordReaderRecoveryResult, retainReaderRecoveries, renewOfflineSave, stageOfflineSave, stageReaderReplay, type PendingReaderMutation} from './offline-store';
import {rebaseReaderMutations, type ReaderRecovery} from './rebase';

type UpgradeApi = Pick<ReturnType<typeof createReaderApi>, 'current' | 'renew' | 'privateState' | 'mutate'>;
export type ReaderUpgrade = {value: OnlineBulletinAccess; previousRevision: number; state: BulletinReaderState; queue: PendingReaderMutation[]; mutations: BulletinReaderMutation[]; recovery: ReaderRecovery[]};

/** User-accepted update only. Never called from automatic foreground synchronization. */
export async function prepareReaderUpgrade(api: UpgradeApi, selector: ReaderSelector, value: OnlineBulletinAccess, epoch: number, signal: AbortSignal, now = Date.now): Promise<ReaderUpgrade> {
  return navigator.locks.request(`hhc-weekly-reader-sync:${selector.accountId}`, {signal}, async () => {
    const fresh = await api.renew(selector, value, crypto.randomUUID(), signal);
    signal.throwIfAborted();
    await renewOfflineSave(selector, fresh, epoch, now());
    const previous = await readPrivateReplica(selector, now());
    const current = await api.current(selector, value, crypto.randomUUID(), signal);
    const cloud = await api.privateState(selector, value, signal);
    signal.throwIfAborted();
    if (current.document.revision < value.document.revision || cloud.state.currentRevision !== current.document.revision || cloud.fromRevision !== value.document.revision) throw new Error('revision_changed');
    let queue = previous?.queue ?? [];
    let state = cloud.state;
    const pending: BulletinReaderMutation[] = [];
    const recovery: ReaderRecovery[] = [];
    for (const original of queue) {
      signal.throwIfAborted();
      let entry = queue.find(entry => entry.mutation.mutationId === original.mutation.mutationId)!;
      if (entry.resolution) {
        if (!entry.resolution.mutation || entry.resolution.result?.status === 'applied') continue;
        const resolution = entry.resolution.result;
        if (resolution) recovery.push({mutationId: entry.mutation.mutationId, reason: resolution.status === 'note_conflict' ? 'note_conflict' : resolution.status === 'revision_changed' ? 'mapping_unavailable' : 'color_conflict'});
        continue;
      }
      let result = entry.replayResult ?? entry.result;
      if (result?.status === 'applied') continue;
      if (entry.recoveryReason) {recovery.push({mutationId: entry.mutation.mutationId, reason: entry.recoveryReason}); continue;}
      if (now() - Date.parse(entry.mutation.createdAt) > 90 * 86400000) {recovery.push({mutationId: entry.mutation.mutationId, reason: 'expired_mutation'}); continue;}
      // An interrupted send may already be terminal on the server. Resolve its
      // exact fingerprint before changing revision/anchors under the same ID.
      if ((entry.sent || entry.replay || entry.mutation.kind === 'resolveHighlightMigrationConflict') && !result) {
        const request = entry.replay ?? entry.mutation;
        queue = await stageReaderReplay(selector, entry.mutation.mutationId, request, epoch, now(), queue);
        const response = await api.mutate(selector, current, [request], signal);
        signal.throwIfAborted();
        queue = await recordReaderReplayResult(selector, response.results[0], epoch, queue, now());
        state = response.state; result = response.results[0];
        entry = queue.find(entry => entry.mutation.mutationId === original.mutation.mutationId)!;
      }
      if (result?.status === 'applied') continue;
      if (result && result.status !== 'revision_changed') {
        recovery.push({mutationId: entry.mutation.mutationId, reason: result.status === 'note_conflict' ? 'note_conflict' : result.status === 'recovery_required' ? 'expired_mutation' : 'color_conflict'});
      } else pending.push(entry.mutation);
    }
    const owner = await getOfflineIdentity();
    if (owner.accountId !== selector.accountId || owner.epoch !== epoch) throw new Error('offline_account_changed');
    if (state.currentRevision !== current.document.revision) throw new Error('revision_changed');
    const base = previous?.confirmed ?? {...state, currentRevision: value.document.revision, appliedRevision: value.document.revision, highlights: [], notes: [], progress: null, conflicts: []};
    const rebased = rebaseReaderMutations(pending, base, state, cloud.mappings ?? []);
    if (rebased.recovery.length) queue = await retainReaderRecoveries(selector, rebased.recovery, epoch, queue, now());
    return {value: current, previousRevision: value.document.revision, state, queue, mutations: rebased.mutations, recovery: [...recovery, ...rebased.recovery]};
  });
}

export async function finishReaderUpgrade(api: UpgradeApi, selector: ReaderSelector, prepared: ReaderUpgrade, epoch: number, signal: AbortSignal, fetcher = globalThis.fetch.bind(globalThis), now = Date.now) {
  return navigator.locks.request(`hhc-weekly-reader-sync:${selector.accountId}`, {signal}, async () => {
    if (prepared.recovery.length || prepared.state.conflicts.length) throw new Error('action_required');
    let queue = prepared.queue;
    let state = prepared.state;
    for (const entry of prepared.queue) {
      signal.throwIfAborted();
      if ((entry.resolution?.result ?? entry.replayResult ?? entry.result)?.status === 'applied') continue;
      const mutation = entry.resolution ? entry.resolution.mutation : prepared.mutations.find(mutation => mutation.mutationId === entry.mutation.mutationId);
      if (!mutation) continue;
      if (!entry.resolution) queue = await stageReaderReplay(selector, mutation.mutationId, mutation, epoch, now(), queue);
      const response = await api.mutate(selector, prepared.value, [mutation], signal);
      signal.throwIfAborted();
      queue = await (entry.resolution ? recordReaderRecoveryResult : recordReaderReplayResult)(selector, response.results[0], epoch, queue, now());
      state = response.state;
      if (response.results[0].status !== 'applied' || state.currentRevision !== prepared.value.document.revision) throw new Error('action_required');
    }
    const staged = await stageOfflineSave(prepared.value, selector, fetcher, now(), signal);
    signal.throwIfAborted();
    await commitOfflineUpgrade(staged, state, epoch, prepared.previousRevision, queue, now());
    return prepared.value;
  });
}
