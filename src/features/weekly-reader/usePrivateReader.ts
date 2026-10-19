'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {BulletinReaderMutation, BulletinReaderMutationResponse, BulletinReaderState, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {awaitReaderRequests, type createReaderApi, type ReaderSelector} from './api';
import {isBookmarkMutation} from './bookmarks';
import {applyLocalMutation} from './private-state';
import {appendPrivateIntent, acknowledgePrivateIntent, isReaderStorageFailure} from './private-journal';
import {readerFailureAction} from './offline-access';
import {bindOnlinePrivate, readPrivateBinding, type PrivateReplica, enqueuePrivateMutation, getOfflineIdentity, readOfflineSave, readPrivateReplica, seedPrivateReplica, readBookmarkCache, mergeBookmarkCache, readReaderExportLocal, supportsOfflineReader} from './offline-store';
import {syncPrivateReplica, withReaderWriter, type ReaderSyncStatus} from './sync';
import {watchOfflineAccount} from './offline-session';
import {readReaderReturn, saveReaderReturn, readVolatileReader, retainVolatileReader, clearReaderReturn} from './return-state';

export type ReaderOutcome = (BulletinReaderMutationResponse['results'][number] & {durable?: boolean}) | {status: 'queued' | 'deferred'; durable?: boolean};
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
  const [bookmarksSupported, setBookmarksSupported] = useState(false);
  const bookmarkCapability = useRef(false);
  const [bookmarkCacheWarning, setBookmarkCacheWarning] = useState(false);
  const [bookmarkOutcome, setBookmarkOutcome] = useState<BulletinReaderMutationResponse['results'][number] | null>(null);
  const loaded = useRef<'cloud' | 'local' | false>(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingMutation, setPendingMutation] = useState(restored);
  const [retryNeeded, setRetryNeeded] = useState(!!restored);
  const canRetry = retryNeeded || !!pendingMutation && isBookmarkMutation(pendingMutation);
  const [mutationOutcome, setMutationOutcome] = useState<{mutation: BulletinReaderMutation; result: ReaderOutcome} | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const journal = useRef<PrivateReplica | null>(null);
  const journalBlocked = useRef(false);
  const durable = useRef(false), epoch = useRef<number | null>(null), journalVersion = useRef(0);
  const enqueueTail = useRef<Promise<void>>(Promise.resolve());
  const syncRequested = useRef(false), localWrites = useRef(new Map<string, BulletinReaderMutation>());
  const pump = useRef<() => Promise<ReaderOutcome | undefined>>(async () => undefined);
  const controller = useRef<{key: string; request: AbortController} | null>(null);
  const active = useRef<Promise<void> | null>(null);
  const foreground = useRef<AbortController | null>(null);
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
  useEffect(() => {current.current = {api, selector: {accountId, issueNumber, series, contentLocale}, value, offline, allowAction, onFailure};}, [api, accountId, issueNumber, series, contentLocale, value, offline, allowAction, onFailure]);
  useEffect(() => {
    const {value, offline} = current.current;
    const memory = readVolatileReader({accountId, documentId: value.document.documentId});
    const retained = controller.current?.key === key && journal.current?.queue.length && !durable.current ? journal.current : memory?.replica ?? null;
    if (controller.current?.key !== key) pending.current = readReaderReturn({accountId, documentId: value.document.documentId})?.action ?? null;
    const request = new AbortController(), owner = {key, request}; controller.current = owner;
    journal.current = null; loaded.current = false;
    void bounded(request.signal, signal => exclusive(async () => {
      journal.current = null; durable.current = false; journalBlocked.current = false; epoch.current = null; setUnsaved(false);
      setPendingMutation(pending.current); setRetryNeeded(!!pending.current); setMutationOutcome(null);
      setLoadError(false); loaded.current = false; setBookmarkOutcome(null); setBookmarkCacheWarning(false); bookmarkCapability.current = false; setBookmarksSupported(false);
      const bound = {accountId, issueNumber, series, contentLocale};
      const saved = supportsOfflineReader() ? await readOfflineSave(bound).catch(() => null) : null;
      signal.throwIfAborted();
      if (saved?.status === 'available' && (offline || !retained)) {
        if (offline) {
          if (retained && memory?.epoch !== null && memory?.epoch !== undefined && memory.epoch !== saved.save.epoch) {clearReaderReturn({accountId, documentId: value.document.documentId}); throw new Error('offline_account_changed');}
          const local = retained ?? await readPrivateReplica(bound);
          signal.throwIfAborted();
          journal.current = local; durable.current = !retained; epoch.current = saved.save.epoch;
          if (retained) {rememberPending(retained.queue[0]?.mutation ?? null); setUnsaved(!!retained.queue.length); setRetryNeeded(!!retained.queue.length);}
          loaded.current = local ? 'local' : false;
          publishState(local?.state ?? null); publishStatus(local && local.state.currentRevision !== value.document.revision ? 'paused' : local?.queue.some(entry => entry.result) ? 'action' : local?.queue.length ? 'waiting' : 'synced');
          return;
        }
        const synced = await syncPrivateReplica(api, bound, value, saved.save.epoch, signal);
        signal.throwIfAborted();
        bookmarkCapability.current = synced.bookmarksSupported === true; setBookmarksSupported(bookmarkCapability.current);
        journal.current = synced.replica; durable.current = true; epoch.current = saved.save.epoch;
        loaded.current = synced.replica ? 'local' : false;
        publishState(synced.replica?.state ?? null); publishStatus(synced.status); return;
      }
      const cloud = await api.privateState(bound, value, signal);
      signal.throwIfAborted();
      if (retained) {
        if (supportsOfflineReader()) {
          const identity = await getOfflineIdentity();
          if (identity.accountId !== null && identity.accountId !== accountId || memory?.epoch !== null && memory?.epoch !== undefined && (identity.accountId !== accountId || identity.epoch !== memory.epoch)) {clearReaderReturn({accountId, documentId: value.document.documentId}); throw new Error('offline_account_changed');}
          epoch.current = identity.accountId === accountId ? identity.epoch : null;
        }
        signal.throwIfAborted();
        journal.current = retained; loaded.current = 'cloud';
        rememberPending(retained.queue[0]?.mutation ?? null);
        setRetryNeeded(!!retained.queue.length);
        bookmarkCapability.current = Array.isArray(cloud.state.bookmarks); setBookmarksSupported(bookmarkCapability.current);
        publishState(retained.state); setUnsaved(!!retained.queue.length);
        if (retained.state.currentRevision !== value.document.revision || cloud.state.currentRevision !== value.document.revision) {publishState(cloud.state); publishStatus('paused'); return;}
        publishStatus(retained.queue.some(entry => entry.result) ? 'action' : 'waiting');
        if (!offline && retained.queue.length && !retained.queue.some(entry => entry.result)) {syncRequested.current = true; queueMicrotask(() => {void pump.current().catch(() => {});});}
        return;
      }
      if (cloud.state.currentRevision !== value.document.revision) {publishStatus('paused'); return;}
      bookmarkCapability.current = Array.isArray(cloud.state.bookmarks); setBookmarksSupported(bookmarkCapability.current);
      let replica: PrivateReplica = {state: cloud.state, confirmed: cloud.state, queue: []};
      if (supportsOfflineReader()) {
        try {
          const identity = await getOfflineIdentity();
          if (identity.accountId !== accountId && identity.accountId !== null) throw new Error('offline_account_changed');
          if (identity.accountId === accountId) {
            epoch.current = identity.epoch;
            await bindOnlinePrivate(bound, value, identity.epoch);
            const binding = await readPrivateBinding(bound);
            if (!binding.writable) {journal.current = binding.replica ?? null; durable.current = true; loaded.current = 'local'; publishState(cloud.state); publishStatus('paused'); return;}
            replica = await seedPrivateReplica(bound, cloud.state, identity.epoch);
            durable.current = true;
          }
        } catch (error) {if (!isReaderStorageFailure(error)) throw error;}
      }
      signal.throwIfAborted();
      if (pending.current && !isBookmarkMutation(pending.current) && !replica.queue.some(entry => entry.mutation.mutationId === pending.current?.mutationId)) {replica = {...replica, queue: [{mutation: pending.current, sent: true}, ...replica.queue]}; durable.current = false;}
      journal.current = replica; loaded.current = durable.current ? 'local' : 'cloud';
      publishState(replica.state); publishStatus(replica.queue.some(entry => entry.result) ? 'action' : replica.queue.length ? 'waiting' : 'synced');
      setUnsaved(!durable.current && !!replica.queue.length);
      if (durable.current && replica.queue.length && !replica.queue.some(entry => entry.result)) {syncRequested.current = true; queueMicrotask(() => {void pump.current().catch(() => {});});}
    }, signal)).catch(async error => {
      if (request.signal.aborted || controller.current !== owner) return;
      if (!(error instanceof ReaderActionError)) current.current.onFailure(error);
      const action = error instanceof ReaderActionError ? 'retain' : readerFailureAction(error);
      const fallbackBase = stateRef.current;
      loaded.current = false; setLoadError(true); publishStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
      const local = supportsOfflineReader() && (action === 'retain' || action === 'login') ? await bounded(request.signal, fallbackSignal => interruptible(readPrivateReplica({accountId, issueNumber, series, contentLocale}), fallbackSignal)).catch(() => null) : null;
      if (request.signal.aborted || controller.current !== owner || stateRef.current !== fallbackBase) return;
      if (local) {journal.current = local; durable.current = true; const identity = await getOfflineIdentity(); epoch.current = identity.epoch; loaded.current = 'local';}
      if (local || !stateRef.current) publishState(local?.state ?? null);
    });
    return () => {request.abort(new ReaderActionError('cancelled')); foreground.current?.abort(new ReaderActionError('cancelled'));};
  }, [api, accountId, issueNumber, series, contentLocale, key, attempt, exclusive, publishState, publishStatus]);

  function rememberPending(mutation: BulletinReaderMutation | null) {
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
    try {
      if (isBookmarkMutation(mutation)) {
        if (context.offline || navigator.onLine === false || !bookmarkCapability.current || rollback.bookmarks === undefined) throw new Error('bookmark_unavailable');
        const cache = supportsOfflineReader() ? await readBookmarkCache(context.selector) : null;
        signal.throwIfAborted();
        if (cache?.pending || cache && (cache.binding.documentId !== context.value.document.documentId || cache.binding.revision !== context.value.document.revision) || !context.allowAction()) throw new Error('bookmark_pending_sync');
        rememberPending(mutation);
        const response = await withReaderWriter(context.selector.accountId, signal, async () => {
          if (!owner || controller.current !== owner || owner.request.signal.aborted || !current.current.allowAction()) throw new ReaderActionError('cancelled');
          return context.api.mutate(context.selector, context.value, [mutation], signal);
        });
        signal.throwIfAborted();
        const result = response.results[0];
        if (!result || result.mutationId !== mutation.mutationId || response.state.accountId !== context.selector.accountId || response.state.documentId !== context.value.document.documentId || !Array.isArray(response.state.bookmarks)) throw new Error('invalid_reader_binding');
        setBookmarkOutcome(result);
        if (result.status !== 'revision_changed') rememberPending(null);
        setLoadError(false);
        if (response.state.currentRevision !== context.value.document.revision) {publishState(rollback); publishStatus('paused'); return result;}
        let next = response.state;
        if (cache && response.state.bookmarks) {
          try {const merged = await mergeBookmarkCache(context.selector, cache.binding, response.state); journal.current = merged; next = merged.state; setBookmarkCacheWarning(false);}
          catch {setBookmarkCacheWarning(true); next = {...rollback, bookmarks: response.state.bookmarks};}
        }
        if (!owner || owner !== controller.current || owner.request.signal.aborted || !context.allowAction()) throw new ReaderActionError('cancelled');
        if (journal.current && !journal.current.queue.length) journal.current = {state: next, confirmed: next, queue: []};
        publishState(next); publishStatus(result.status === 'applied' ? journal.current?.queue.length ? 'waiting' : 'synced' : 'action');
        if (journal.current?.queue.length && durable.current) syncRequested.current = true;
        return result;
      }
      throw new Error('bookmark_unavailable');
    } catch (error) {
      if (owner === controller.current && !owner?.request.signal.aborted) {
        if (!(error instanceof ReaderActionError) && !signal.aborted) context.onFailure(error);
        const action = error instanceof ReaderActionError || signal.aborted ? 'retain' : readerFailureAction(error);
        publishState(rollback); publishStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
      }
      throw error;
    }
  }
  async function mutateBookmark(input: BulletinReaderMutation, retrying = false): Promise<ReaderOutcome> {
    const owner = controller.current;
    if (!owner || owner.key !== key || owner.request.signal.aborted || !stateRef.current || statusRef.current === 'paused' || !current.current.allowAction()) throw new ReaderActionError('cancelled');
    if (retrying && active.current) throw new ReaderActionError('busy');
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
  function showJournal() {
    const replica = journal.current;
    if (!replica) return;
    retainVolatileReader(current.current.selector, current.current.value.document.revision, epoch.current, replica, !durable.current || !!localWrites.current.size);
    publishState(replica.state);
    setUnsaved(!durable.current && !!replica.queue.length);
    if (!replica.queue.length) setRetryNeeded(false);
    if (!durable.current) rememberPending(replica.queue[0]?.mutation ?? null);
  }
  async function refreshJournal(owner: NonNullable<typeof controller.current>) {
    if (!durable.current) return;
    while (controller.current === owner && !owner.request.signal.aborted) {
      const version = journalVersion.current;
      await enqueueTail.current;
      const local = await readPrivateReplica(current.current.selector);
      if (version !== journalVersion.current) continue;
      if (controller.current !== owner || owner.request.signal.aborted) return;
      if (local && durable.current) {journal.current = local; showJournal();}
      return;
    }
  }
  async function syncJournal(): Promise<ReaderOutcome | undefined> {
    const owner = controller.current, context = current.current;
    if (!owner || owner.request.signal.aborted || journalBlocked.current || context.offline || !context.allowAction() || statusRef.current === 'paused') return;
    if (active.current) {syncRequested.current = true; return;}
    syncRequested.current = false; setRetryNeeded(false);
    let outcome: ReaderOutcome | undefined;
    try {
      await bounded(owner.request.signal, signal => exclusive(async () => {
        try {
          await enqueueTail.current;
          signal.throwIfAborted();
          if (!journal.current?.queue.length) return;
          publishStatus('syncing');
          if (durable.current && epoch.current !== null) {
            const result = await syncPrivateReplica(context.api, context.selector, context.value, epoch.current, signal, Date.now, (mutation, result) => {setMutationOutcome({mutation, result: {...result, durable: true}});});
            signal.throwIfAborted();
            await refreshJournal(owner);
            if (journalBlocked.current) {publishStatus('action'); return;}
            const remaining = journal.current?.queue ?? [];
            publishStatus(remaining.some(entry => entry.result) ? 'action' : remaining.length ? 'waiting' : result.status);
            if (result.status === 'synced' && remaining.length && !remaining.some(entry => entry.result)) syncRequested.current = true;
            if (result.status === 'synced') outcome = {status: 'applied', mutationId: '', revision: context.value.document.revision};
          } else {
            const sendMemory = async () => {
              while (journal.current?.queue.length) {
                signal.throwIfAborted();
                if (controller.current !== owner || !current.current.allowAction()) throw new ReaderActionError('cancelled');
                if (epoch.current !== null) {
                  const identity = await getOfflineIdentity(); signal.throwIfAborted();
                  if (identity.accountId !== context.selector.accountId || identity.epoch !== epoch.current) throw new Error('offline_account_changed');
                }
                const entry = journal.current.queue[0];
                if (entry.result) {publishStatus(entry.result.status === 'revision_changed' ? 'paused' : 'action'); break;}
                if (!Number.isFinite(Date.parse(entry.mutation.createdAt)) || Date.now() - Date.parse(entry.mutation.createdAt) > 90 * 86400000) {
                  entry.result = {mutationId: entry.mutation.mutationId, status: 'recovery_required', revision: context.value.document.revision};
                  showJournal(); break;
                }
                entry.sent = true;
                const response = await context.api.mutate(context.selector, context.value, [entry.mutation], signal);
                signal.throwIfAborted();
                journal.current = acknowledgePrivateIntent(journal.current, response, context.value.document);
                outcome = response.results[0]; setMutationOutcome({mutation: entry.mutation, result: outcome}); showJournal();
                if (outcome.status !== 'applied') {publishStatus(outcome.status === 'revision_changed' ? 'paused' : 'action'); return;}
              }
            };
            await withReaderWriter(context.selector.accountId, signal, sendMemory);
            const first = journal.current?.queue[0];
            publishStatus(first?.result ? first.result.status === 'revision_changed' ? 'paused' : 'action' : first ? 'waiting' : 'synced');
          }
        } catch (error) {syncRequested.current = false; throw error;}
      }, signal));
    } catch (error) {
      syncRequested.current = false;
      if (controller.current !== owner || owner.request.signal.aborted) return;
      if (isReaderStorageFailure(error)) {durable.current = false; showJournal();}
      else if (!(error instanceof ReaderActionError)) context.onFailure(error);
      const action = isReaderStorageFailure(error) || error instanceof ReaderActionError ? 'retain' : readerFailureAction(error);
      if (action === 'lock' || action === 'purge') journalBlocked.current = true;
      if (durable.current && (action === 'retain' || action === 'login')) await refreshJournal(owner).catch(() => {});
      publishStatus(action === 'retain' || action === 'login' ? 'waiting' : 'action');
      setRetryNeeded(action === 'retain' || action === 'login');
      throw error;
    }
    return outcome;
  }
  useEffect(() => {pump.current = syncJournal;});
  async function mutate(input: BulletinReaderMutation, retrying = false, onAccepted?: () => void): Promise<ReaderOutcome> {
    if (isBookmarkMutation(input)) return mutateBookmark(input, retrying);
    const owner = controller.current, context = current.current;
    if (!owner || owner.key !== key || owner.request.signal.aborted || !journal.current || journalBlocked.current || journal.current.state.accountId !== context.selector.accountId || journal.current.state.documentId !== context.value.document.documentId || !context.allowAction() || ['paused', 'action'].includes(statusRef.current)) throw new ReaderActionError('cancelled');
    if (pending.current && isBookmarkMutation(pending.current)) throw new Error('pending_action_requires_retry');
    const snapshot = structuredClone(input);
    try {journal.current = appendPrivateIntent(journal.current, snapshot, context.value.document);}
    catch (error) {
      if (error instanceof Error && error.message === 'note_conflict' && 'noteId' in snapshot.payload) return {status: 'note_conflict', mutationId: snapshot.mutationId, revision: context.value.document.revision, note: journal.current.state.notes.find(note => 'noteId' in snapshot.payload && note.id === snapshot.payload.noteId)};
      throw error;
    }
    const version = ++journalVersion.current; localWrites.current.set(snapshot.mutationId, snapshot);
    if (durable.current && !pending.current) rememberPending(snapshot);
    showJournal(); publishStatus(context.offline ? 'waiting' : 'syncing'); onAccepted?.();
    let committed = false;
    const queued = enqueueTail.current.then(async () => {
      if (!owner || controller.current !== owner || owner.request.signal.aborted || !current.current.allowAction()) throw new ReaderActionError('cancelled');
      if (durable.current && epoch.current !== null) {
        try {
          await bindOnlinePrivate(context.selector, current.current.value, epoch.current);
          const local = await enqueuePrivateMutation(context.selector, snapshot, epoch.current);
          committed = true;
          if (controller.current !== owner || owner.request.signal.aborted) throw new ReaderActionError('cancelled');
          if (version === journalVersion.current) {journal.current = local; showJournal();}
        } catch (error) {
          if (!isReaderStorageFailure(error)) {journalBlocked.current = true; publishStatus('action'); throw error;}
          durable.current = false; showJournal();
        }
      }
    });
    const persisted = queued.finally(() => {
      localWrites.current.delete(snapshot.mutationId);
      if (controller.current === owner && !owner.request.signal.aborted) {
        if (!committed && durable.current) {durable.current = false; showJournal();}
        else if (durable.current) rememberPending(localWrites.current.values().next().value ?? null);
        if (journal.current) retainVolatileReader(context.selector, context.value.document.revision, epoch.current, journal.current, !durable.current || !!localWrites.current.size);
      }
    });
    enqueueTail.current = persisted.catch(() => {});
    try {await persisted;} catch (error) {if (controller.current === owner && !owner.request.signal.aborted) {if (isReaderStorageFailure(error)) durable.current = false; else if (!(error instanceof ReaderActionError)) context.onFailure(error); setUnsaved(true);} throw error;}
    if (controller.current === owner && !owner.request.signal.aborted && !context.offline) {syncRequested.current = true; queueMicrotask(() => {void pump.current().catch(() => {});});
    }
    return {status: 'queued', durable: durable.current};
  }
  useEffect(() => {
    drain.current = () => {
      if (!active.current && syncRequested.current && journal.current?.queue.length && !['action', 'paused'].includes(statusRef.current)) queueMicrotask(() => {void pump.current().catch(() => {});});
    };
    const warn = (event: BeforeUnloadEvent) => {if (localWrites.current.size || !durable.current && journal.current?.queue.length) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    const reconnect = () => {if (!offline && journal.current?.queue.length && !['action', 'paused'].includes(statusRef.current)) void pump.current().catch(() => {});};
    reconnect(); window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [offline]);
  useEffect(() => watchOfflineAccount(activeAccount => {
    if (activeAccount !== accountId) {
      controller.current?.request.abort(new ReaderActionError('cancelled'));
      journal.current = null; loaded.current = false;
      publishState(null); publishStatus('action');
      return;
    }
    if (activeAccount === accountId && !durable.current) setAttempt(attempt => attempt + 1);
  }), [accountId, publishState, publishStatus]);
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
      if (!owner || controller.current !== owner || owner.request.signal.aborted || !loaded.current || !next || !current.current.allowAction() || pending.current || journal.current?.queue.length && !durable.current || foreground.current || ['action', 'paused', 'syncing'].includes(statusRef.current) || next.accountId !== context.selector.accountId || next.documentId !== context.value.document.documentId || next.currentRevision !== context.value.document.revision || next.appliedRevision !== next.currentRevision || next.conflicts.length) throw new Error('export_unavailable');
      return next;
    };
    ready();
    if (active.current) throw new ReaderActionError('busy');
    return runExclusive(async signal => {
      await enqueueTail.current;
      signal.throwIfAborted();
      const cloud = ready();
      const local = supportsOfflineReader() ? await readReaderExportLocal(context.selector, context.value.document.documentId, context.value.document.revision) : null;
      signal.throwIfAborted(); ready();
      if ((context.offline || loaded.current === 'local') && !local) throw new Error('export_unavailable');
      const source = local?.state ?? cloud;
      const notes = source.notes.filter(note => !note.deleted && (!ids || ids.includes(note.id)));
      if (notes.length > 200) throw new Error('export_limit');
      if (notes.length === 0 || source.conflicts.length) throw new Error('export_unavailable');
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
  return {state, status, busy, operation, loadError, unsaved, mutationOutcome, bookmarksSupported, bookmarkCacheWarning, bookmarkOutcome, prepareExport, reload: () => setAttempt(value => value + 1), mutate,
    retry: () => active.current ? Promise.reject(new ReaderActionError('busy')) : pending.current && isBookmarkMutation(pending.current) ? mutateBookmark(pending.current, true) : syncJournal(), canRetry,
    cancelWaiting: () => {foreground.current?.abort(new ReaderActionError('cancelled'));},
    hasUncommitted: () => localWrites.current.size > 0 || !durable.current && !!journal.current?.queue.length,
    pendingMutation, replacePending: (mutation: BulletinReaderMutation | null, expectedId: string | null) => {
      if ((pending.current?.mutationId ?? null) !== expectedId) throw new Error('pending_action_changed');
      if (!durable.current && journal.current?.queue.length && !isBookmarkMutation(journal.current.queue[0].mutation)) {
        const queue = journal.current.queue.slice(1);
        if (mutation) queue.unshift({mutation, sent: true});
        let projected = journal.current.confirmed;
        try {for (const entry of queue) projected = applyLocalMutation(projected, entry.mutation, current.current.value.document);} catch {projected = journal.current.state;}
        journal.current = {...journal.current, queue, state: projected};
        publishStatus(queue.some(entry => entry.result) ? 'action' : queue.length ? 'waiting' : 'synced');
        showJournal(); return journal.current.queue[0]?.mutation ?? null;
      }
      rememberPending(mutation); return mutation;
    }, runExclusive, acceptState: (next: BulletinReaderState) => {
      const context = current.current;
      if (controller.current?.key !== key || controller.current.request.signal.aborted) return;
      if (next.accountId !== context.selector.accountId || next.documentId !== context.value.document.documentId) throw new Error('invalid_reader_binding');
      if (next.currentRevision !== context.value.document.revision) {publishStatus('paused'); return;}
      if (journal.current && !durable.current) {
        let projected = next;
        try {for (const entry of journal.current.queue) projected = applyLocalMutation(projected, entry.mutation, context.value.document);}
        catch {projected = next;}
        journal.current = {...journal.current, confirmed: next, state: projected};
      }
      publishState(next);
    }};
}
