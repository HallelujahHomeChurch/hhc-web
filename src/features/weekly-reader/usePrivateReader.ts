'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {BulletinReaderMutation, BulletinReaderMutationResponse, BulletinReaderState, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {awaitReaderRequests, type createReaderApi, type ReaderSelector} from './api';
import {optimisticReaderState} from './private-state';
import {readerFailureAction} from './offline-access';
import {enqueuePrivateMutation, getOfflineIdentity, readOfflineSave, readPrivateReplica, seedPrivateReplica, readReaderExportLocal, supportsOfflineReader} from './offline-store';
import {syncPrivateReplica, type ReaderSyncStatus} from './sync';
import {readReaderReturn, saveReaderReturn} from './return-state';

export type ReaderOutcome = (BulletinReaderMutationResponse['results'][number] & {durable?: boolean}) | {status: 'queued' | 'deferred'};
export type ReaderOperation = 'idle' | 'waiting' | 'confirming' | 'sending' | 'timeout';
export class ReaderActionError extends Error {
  constructor(readonly reason: 'cancelled' | 'timeout' | 'busy') {super(`reader_action_${reason}`);}
}
export type ReaderExclusive = <T>(work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => Promise<T>;
function interruptible<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {void work.catch(() => {}); return Promise.reject(signal.reason);}
  let abort!: () => void;
  return new Promise<T>((resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
    work.then(resolve, reject);
  }).finally(() => signal.removeEventListener('abort', abort));
}
function bounded<T>(owner: AbortSignal, work: (signal: AbortSignal) => Promise<T>, request = new AbortController()): Promise<T> {
  const abort = () => request.abort(owner.reason ?? new ReaderActionError('cancelled'));
  if (owner.aborted) abort(); else owner.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(() => request.abort(new ReaderActionError('timeout')), 20000);
  return interruptible(Promise.resolve().then(() => {request.signal.throwIfAborted(); return work(request.signal);}), request.signal)
    .finally(() => {clearTimeout(timer); owner.removeEventListener('abort', abort); request.abort(new ReaderActionError('cancelled'));});
}
type Props = {api: Pick<ReturnType<typeof createReaderApi>, 'privateState' | 'mutate' | 'renew'>; selector: ReaderSelector; value: OnlineBulletinAccess; offline: boolean; allowAction: () => boolean; onFailure: (error: unknown) => void};
export function usePrivateReader({api, selector, value, offline, allowAction, onFailure}: Props) {
  const binding = {accountId: selector.accountId, documentId: value.document.documentId};
  const key = JSON.stringify([selector.accountId, selector.issueNumber, selector.series, selector.contentLocale, value.document.documentId, value.document.revision]);
  const [restored] = useState(() => readReaderReturn(binding)?.action ?? null);
  const [state, setState] = useState<BulletinReaderState | null>(null);
  const stateRef = useRef(state);
  const [status, setStatus] = useState<ReaderSyncStatus>('syncing');
  const statusRef = useRef(status);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<ReaderOperation>('idle');
  const [loadError, setLoadError] = useState(false);
  const loaded = useRef<'cloud' | 'local' | false>(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingMutation, setPendingMutation] = useState(restored);
  const canRetry = !!pendingMutation;
  const controller = useRef<{key: string; request: AbortController} | null>(null);
  const active = useRef<Promise<void> | null>(null);
  const foreground = useRef<AbortController | null>(null);
  const progress = useRef<BulletinReaderMutation | null>(null);
  const pending = useRef<BulletinReaderMutation | null>(restored);
  const changed = useRef(new Set<() => void>());
  const drain = useRef<() => void>(() => {});
  const current = useRef({api, selector, value, offline, allowAction, onFailure});
  const publishState = useCallback((next: BulletinReaderState | null) => {stateRef.current = next; setState(next);}, []);
  const publishStatus = useCallback((next: ReaderSyncStatus) => {statusRef.current = next; setStatus(next);}, []);
  const exclusive = useCallback(async <T,>(work: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> => {
    const owner = controller.current;
    while (active.current) await interruptible(active.current, signal);
    signal.throwIfAborted();
    if (!owner || controller.current !== owner || owner.key !== key || owner.request.signal.aborted) throw new ReaderActionError('cancelled');
    // Publish the lock before calling work; UI timeout never releases this lock.
    const job = Promise.resolve().then(() => {signal.throwIfAborted(); return work(signal);}).finally(() => awaitReaderRequests(signal));
    const finished = job.then(() => {}, () => {}).finally(() => {
      if (active.current === finished) {active.current = null; setBusy(false); drain.current();}
    });
    active.current = finished; setBusy(true);
    return job;
  }, [key]);
  const {accountId, issueNumber, series, contentLocale} = selector;
  useEffect(() => {current.current.allowAction = allowAction; current.current.onFailure = onFailure;}, [allowAction, onFailure]);
  useEffect(() => {
    current.current = {...current.current, api, selector: {accountId, issueNumber, series, contentLocale}, value, offline};
    const request = new AbortController(), owner = {key, request}; controller.current = owner;
    void bounded(request.signal, signal => exclusive(async () => {
      setLoadError(false); loaded.current = false;
      const bound = {accountId, issueNumber, series, contentLocale};
      const saved = supportsOfflineReader() ? await readOfflineSave(bound).catch(() => null) : null;
      signal.throwIfAborted();
      if (saved?.status === 'available') {
        if (offline) {
          const local = await readPrivateReplica(bound);
          signal.throwIfAborted();
          loaded.current = local ? 'local' : false;
          publishState(local?.state ?? null); publishStatus(local?.queue.some(entry => entry.result) ? 'action' : local?.queue.length ? 'waiting' : 'synced');
          return;
        }
        const synced = await syncPrivateReplica(api, bound, value, saved.save.epoch, signal);
        signal.throwIfAborted();
        loaded.current = synced.replica ? 'local' : false;
        publishState(synced.replica?.state ?? null); publishStatus(synced.status); return;
      }
      const cloud = await api.privateState(bound, value, signal);
      signal.throwIfAborted();
      if (cloud.state.currentRevision !== value.document.revision) {publishStatus('paused'); return;}
      loaded.current = 'cloud'; publishState(cloud.state); publishStatus('synced');
    }, signal)).catch(async error => {
      if (request.signal.aborted || controller.current !== owner) return;
      if (!(error instanceof ReaderActionError)) current.current.onFailure(error);
      const action = error instanceof ReaderActionError ? 'retain' : readerFailureAction(error);
      const fallbackBase = stateRef.current;
      loaded.current = false; setLoadError(true); publishStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
      const local = supportsOfflineReader() && (action === 'retain' || action === 'login') ? await bounded(request.signal, fallbackSignal => interruptible(readPrivateReplica({accountId, issueNumber, series, contentLocale}), fallbackSignal)).catch(() => null) : null;
      if (request.signal.aborted || controller.current !== owner || stateRef.current !== fallbackBase) return;
      if (local || !stateRef.current) publishState(local?.state ?? null);
    });
    return () => {request.abort(new ReaderActionError('cancelled')); foreground.current?.abort(new ReaderActionError('cancelled')); progress.current = null;};
  }, [api, accountId, issueNumber, series, contentLocale, value, offline, key, attempt, exclusive, publishState, publishStatus]);

  function replacePending(mutation: BulletinReaderMutation | null) {
    pending.current = mutation; setPendingMutation(mutation);
    const context = current.current;
    saveReaderReturn({accountId: context.selector.accountId, documentId: context.value.document.documentId}, {revision: context.value.document.revision, action: mutation});
    for (const notify of changed.current) notify();
    drain.current();
  }
  async function send(input: BulletinReaderMutation, signal: AbortSignal): Promise<ReaderOutcome> {
    const context = current.current, owner = controller.current;
    const rollback = stateRef.current;
    if (!rollback || statusRef.current === 'paused' || !context.allowAction()) throw new ReaderActionError('cancelled');
    const previous = pending.current;
    if (previous && JSON.stringify([previous.kind, previous.payload, previous.baseVersion]) !== JSON.stringify([input.kind, input.payload, input.baseVersion])) throw new Error('pending_action_requires_retry');
    const mutation = previous ?? input;
    let queued = false;
    try {
      if (mutation.documentRevision === context.value.document.revision) publishState(optimisticReaderState(rollback, mutation, context.value.document));
      const saved = supportsOfflineReader() ? await readOfflineSave(context.selector).catch(() => null) : null;
      signal.throwIfAborted();
      if (!context.allowAction()) throw new ReaderActionError('cancelled');
      if (saved?.status === 'available') {
        const identity = await getOfflineIdentity();
        if (identity.accountId !== context.selector.accountId) throw new ReaderActionError('cancelled');
        await seedPrivateReplica(context.selector, rollback, identity.epoch);
        signal.throwIfAborted();
        const local = await enqueuePrivateMutation(context.selector, mutation, identity.epoch);
        queued = true;
        signal.throwIfAborted(); setLoadError(false); replacePending(null);
        publishState(local.state); publishStatus('waiting');
        if (context.offline) return {status: 'queued'};
        publishStatus('syncing');
        const synced = await syncPrivateReplica(context.api, context.selector, context.value, identity.epoch, signal);
        signal.throwIfAborted();
        publishState(synced.replica?.state ?? local.state); publishStatus(synced.status);
        const conflict = synced.replica?.queue.find(entry => entry.mutation.mutationId === mutation.mutationId)?.result;
        if (conflict) return {...conflict, durable: true};
        if (synced.status !== 'synced') throw new Error('action_required');
        return {mutationId: mutation.mutationId, status: 'applied', revision: context.value.document.revision};
      }
      if (context.offline) throw new Error('offline_save_required');
      replacePending(mutation);
      const response = await context.api.mutate(context.selector, context.value, [mutation], signal);
      signal.throwIfAborted();
      setLoadError(false);
      if (response.results[0].status !== 'revision_changed') replacePending(null);
      if (response.state.currentRevision !== context.value.document.revision) {publishState(rollback); publishStatus('paused');}
      else {publishState(response.state); publishStatus(response.results[0].status === 'applied' ? 'synced' : 'action');}
      return response.results[0];
    } catch (error) {
      if (owner === controller.current && !owner?.request.signal.aborted) {
        if (!(error instanceof ReaderActionError) && !signal.aborted) context.onFailure(error);
        const action = error instanceof ReaderActionError || signal.aborted ? 'retain' : readerFailureAction(error);
        if (queued && (action === 'retain' || action === 'login') && context.allowAction()) {
          if (signal.aborted) {publishStatus('waiting'); throw error;}
          const local = await readPrivateReplica(context.selector).catch(() => null);
          signal.throwIfAborted();
          if (local) {publishState(local.state); publishStatus('waiting'); return {status: 'queued'};}
        }
        publishState(rollback); publishStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
      }
      throw error;
    }
  }
  async function mutate(input: BulletinReaderMutation, retrying = false): Promise<ReaderOutcome> {
    const owner = controller.current;
    if (!owner || owner.key !== key || owner.request.signal.aborted || !stateRef.current || statusRef.current === 'paused' || !current.current.allowAction()) throw new ReaderActionError('cancelled');
    if (retrying && active.current) throw new ReaderActionError('busy');
    if (!retrying && input.kind === 'setProgress' && (active.current || foreground.current || pending.current)) {progress.current = structuredClone(input); return {status: 'deferred'};}
    const user = !retrying && input.kind !== 'setProgress';
    if (user && foreground.current) throw new ReaderActionError('busy');
    const request = new AbortController(), snapshot = structuredClone(input);
    if (user) {foreground.current = request; setOperation('waiting');}
    try {
      const result = await bounded(owner.request.signal, async signal => {
        while (true) {
          while (active.current) await interruptible(active.current, signal);
          signal.throwIfAborted();
          if (controller.current !== owner || !current.current.allowAction() || statusRef.current === 'paused') throw new ReaderActionError('cancelled');
          const previous = pending.current;
          if (!retrying && previous && JSON.stringify([previous.kind, previous.payload, previous.baseVersion]) !== JSON.stringify([snapshot.kind, snapshot.payload, snapshot.baseVersion])) {
            if (user) setOperation('confirming');
            let notify!: () => void;
            const change = new Promise<void>(resolve => {notify = resolve; changed.current.add(notify);});
            try {await interruptible(change, signal);} finally {changed.current.delete(notify);}
            continue;
          }
          return exclusive(async () => {if (user) setOperation('sending'); return send(snapshot, signal);}, signal);
        }
      }, request);
      if (user && foreground.current === request) setOperation('idle');
      return result;
    } catch (error) {
      if (user && foreground.current === request) setOperation(error instanceof ReaderActionError && error.reason === 'timeout' ? 'timeout' : 'idle');
      throw error;
    } finally {
      if (user && foreground.current === request) {foreground.current = null;}
      drain.current();
    }
  }
  useEffect(() => {
    drain.current = () => {
      if (!active.current && !foreground.current && !pending.current && progress.current) {
        const next = progress.current; progress.current = null;
        queueMicrotask(() => {void mutate(next).catch(() => {});});
      }
    };
  });
  const runExclusive: ReaderExclusive = (work, signal) => {
    const owner = controller.current;
    if (!owner || owner.key !== key || owner.request.signal.aborted) return Promise.reject(new ReaderActionError('cancelled'));
    const request = new AbortController();
    const abort = () => request.abort(signal?.reason ?? new ReaderActionError('cancelled'));
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, {once: true});
    return bounded(owner.request.signal, child => exclusive(async () => {if (!current.current.allowAction()) throw new ReaderActionError('cancelled'); return work(child);}, child), request).finally(() => signal?.removeEventListener('abort', abort));
  };
  async function prepareExport(ids: readonly string[] | null) {
    const owner = controller.current, context = current.current;
    const ready = () => {
      const next = stateRef.current;
      if (!owner || controller.current !== owner || owner.request.signal.aborted || !loaded.current || !next || !current.current.allowAction() || pending.current || foreground.current || ['action', 'paused', 'syncing'].includes(statusRef.current) || next.accountId !== context.selector.accountId || next.documentId !== context.value.document.documentId || next.currentRevision !== context.value.document.revision || next.appliedRevision !== next.currentRevision || next.conflicts.length) throw new Error('export_unavailable');
      return next;
    };
    ready();
    if (active.current) throw new ReaderActionError('busy');
    return runExclusive(async signal => {
      const cloud = ready();
      const local = supportsOfflineReader() ? await readReaderExportLocal(context.selector, context.value.document.documentId, context.value.document.revision) : null;
      signal.throwIfAborted(); ready();
      if ((context.offline || loaded.current === 'local') && !local) throw new Error('export_unavailable');
      const source = local?.state ?? cloud;
      const notes = source.notes.filter(note => !note.deleted && (!ids || ids.includes(note.id)));
      if (notes.length === 0 || notes.length > 200 || source.conflicts.length) throw new Error('export_unavailable');
      const fingerprint = JSON.stringify(cloud.notes), localFingerprint = local?.fingerprint;
      const pendingNoteIds = new Set(local?.queue.flatMap(entry => ['createNote', 'editNote', 'reanchorNote'].includes(entry.mutation.kind) && 'noteId' in entry.mutation.payload ? [entry.mutation.payload.noteId as string] : []) ?? []);
      return {notes: structuredClone(notes), local: !!local, pendingNoteIds,
        validate: (commit: () => void) => runExclusive(async checkSignal => {
          const actual = supportsOfflineReader() ? await readReaderExportLocal(context.selector, context.value.document.documentId, context.value.document.revision) : null;
          checkSignal.throwIfAborted();
          if (JSON.stringify(ready().notes) !== fingerprint || actual?.fingerprint !== localFingerprint) throw new Error('export_changed');
          commit();
        })};
    });
  }
  return {state, status, busy, operation, loadError, prepareExport, reload: () => setAttempt(value => value + 1), mutate,
    retry: () => pending.current ? mutate(pending.current, true) : Promise.resolve(undefined), canRetry,
    cancelWaiting: () => {foreground.current?.abort(new ReaderActionError('cancelled'));},
    pendingMutation, replacePending, runExclusive, acceptState: (next: BulletinReaderState) => {
      const context = current.current;
      if (controller.current?.key !== key || controller.current.request.signal.aborted) return;
      if (next.accountId !== context.selector.accountId || next.documentId !== context.value.document.documentId) throw new Error('invalid_reader_binding');
      if (next.currentRevision !== context.value.document.revision) {publishStatus('paused'); return;}
      publishState(next);
    }};
}
