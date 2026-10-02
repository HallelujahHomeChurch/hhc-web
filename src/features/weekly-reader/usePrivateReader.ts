'use client';
import {useEffect, useRef, useState} from 'react';
import type {BulletinReaderMutation, BulletinReaderMutationResponse, BulletinReaderState, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from './api';
import {optimisticReaderState} from './private-state';
import {readerFailureAction} from './offline-access';
import {enqueuePrivateMutation, getOfflineIdentity, readOfflineSave, readPrivateReplica, seedPrivateReplica, supportsOfflineReader} from './offline-store';
import {syncPrivateReplica, type ReaderSyncStatus} from './sync';
import {readReaderReturn, saveReaderReturn} from './return-state';

type Outcome = BulletinReaderMutationResponse['results'][number] | {status: 'queued'};
type Props = {api: Pick<ReturnType<typeof createReaderApi>, 'privateState' | 'mutate' | 'renew'>; selector: ReaderSelector; value: OnlineBulletinAccess; offline: boolean; allowAction: () => boolean; onFailure: (error: unknown) => void};
export function usePrivateReader({api, selector, value, offline, allowAction, onFailure}: Props) {
	const binding = {accountId: selector.accountId, documentId: value.document.documentId};
	const [restored] = useState(() => readReaderReturn(binding)?.action ?? null);
  const [state, setState] = useState<BulletinReaderState | null>(null);
  const [status, setStatus] = useState<ReaderSyncStatus>('syncing');
  const [busy, setBusy] = useState(false);
  const [canRetry, setCanRetry] = useState(!!restored);
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const pending = useRef<BulletinReaderMutation | null>(restored);
  const {accountId, issueNumber, series, contentLocale} = selector;
  useEffect(() => {
    const request = new AbortController(); controller.current = request;
    const bound = {accountId, issueNumber, series, contentLocale};
    void (async () => {
      const saved = supportsOfflineReader() ? await readOfflineSave(bound).catch(() => null) : null;
      request.signal.throwIfAborted();
      if (saved?.status === 'available') {
        if (offline) {
          const local = await readPrivateReplica(bound);
          request.signal.throwIfAborted();
          setState(local?.state ?? null); setStatus(local?.queue.some(entry => entry.result) ? 'action' : local?.queue.length ? 'waiting' : 'synced');
          return;
        }
        const synced = await syncPrivateReplica(api, bound, value, saved.save.epoch, request.signal);
        request.signal.throwIfAborted();
        setState(synced.replica?.state ?? null); setStatus(synced.status);
        return;
      }
      const cloud = await api.privateState(bound, value, request.signal);
      request.signal.throwIfAborted();
      if (cloud.state.currentRevision !== value.document.revision) {setStatus('paused'); return;}
      setState(cloud.state); setStatus('synced');
    })().catch(async error => {
      if (request.signal.aborted) return;
      onFailure(error);
      const action = readerFailureAction(error);
      const local = supportsOfflineReader() && (action === 'retain' || action === 'login') ? await readPrivateReplica(bound).catch(() => null) : null;
      if (request.signal.aborted) return;
      setState(local?.state ?? null); setStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
    });
    return () => request.abort();
  }, [api, accountId, issueNumber, series, contentLocale, value, offline, onFailure]);

  async function mutate(input: BulletinReaderMutation): Promise<Outcome> {
    const request = controller.current;
    if (!request || request.signal.aborted || sending.current || !state || status === 'paused' || !allowAction()) throw new Error('private_action_unavailable');
    // A lost acknowledgement must retry the same ID, not create a duplicate note.
    const previous = pending.current;
    if (previous && JSON.stringify([previous.kind, previous.payload, previous.baseVersion]) !== JSON.stringify([input.kind, input.payload, input.baseVersion])) throw new Error('pending_action_requires_retry');
    const mutation = previous ?? input;
    const rollback = state;
    sending.current = true; setBusy(true);
    let queued = false;
    try {
      if (mutation.documentRevision === value.document.revision) setState(optimisticReaderState(state, mutation, value.document));
      const saved = supportsOfflineReader() ? await readOfflineSave(selector).catch(() => null) : null;
      request.signal.throwIfAborted();
      if (!allowAction()) throw new Error('private_action_unavailable');
      if (saved?.status === 'available') {
        const owner = await getOfflineIdentity();
        await seedPrivateReplica(selector, state, owner.epoch);
        const local = await enqueuePrivateMutation(selector, mutation, owner.epoch);
        queued = true; replacePending(null);
        request.signal.throwIfAborted();
        setState(local.state); setStatus('waiting');
        if (offline) return {status: 'queued'};
        setStatus('syncing');
        const synced = await syncPrivateReplica(api, selector, value, owner.epoch, request.signal);
        request.signal.throwIfAborted();
        setState(synced.replica?.state ?? local.state); setStatus(synced.status);
        const conflict = synced.replica?.queue.find(entry => entry.mutation.mutationId === mutation.mutationId)?.result;
        // The draft is durable; blocked note writes are resolved in the recovery
        // panel, not by enqueuing another edit behind the blocked operation.
        if (conflict?.status === 'note_conflict') return {status: 'queued'};
        if (conflict) return conflict;
        if (synced.status !== 'synced') throw new Error('action_required');
        return {mutationId: mutation.mutationId, status: 'applied', revision: value.document.revision};
      }
      if (offline) throw new Error('offline_save_required');
      pending.current = mutation; setCanRetry(true);
      saveReaderReturn(binding, {revision: value.document.revision, action: mutation});
      const response = await api.mutate(selector, value, [mutation], request.signal);
      request.signal.throwIfAborted();
      if (response.results[0].status !== 'revision_changed') replacePending(null);
      if (response.state.currentRevision !== value.document.revision) {setState(rollback); setStatus('paused');}
      else {setState(response.state); setStatus(response.results[0].status === 'applied' ? 'synced' : 'action');}
      return response.results[0];
    } catch (error) {
      if (!request.signal.aborted) {
        onFailure(error);
        const action = readerFailureAction(error);
        if (queued && (action === 'retain' || action === 'login') && allowAction()) {
          const local = await readPrivateReplica(selector).catch(() => null);
          request.signal.throwIfAborted();
          if (local) {setState(local.state); setStatus('waiting'); return {status: 'queued'};}
        }
        setState(rollback); setStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
      }
      throw error;
    } finally {sending.current = false; setBusy(false);}
  }
  async function retry() {
    if (!pending.current) return;
    return mutate(pending.current);
  }
  function replacePending(mutation: BulletinReaderMutation | null) {
    pending.current = mutation; setCanRetry(!!mutation);
    saveReaderReturn(binding, {revision: value.document.revision, action: mutation});
  }
  return {state, status, busy, mutate, retry, canRetry, pendingMutation: pending.current, replacePending};
}
