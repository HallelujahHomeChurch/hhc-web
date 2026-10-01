'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {HhcWebApiError, type OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {AccountSessionError} from '@hallelujahhomechurch/account-client';
import {verifyReaderAccess, type createReaderApi, type ReaderSelector} from './api';
import {readerFailureAction} from './offline-access';
import {checkOfflineSave, getOfflineIdentity, lockOfflineSave, readOfflineSave, removeOfflineSave, renewOfflineSave, supportsOfflineReader, watchOfflineEdition} from './offline-store';
import {watchOfflineAccount} from './offline-session';

export function useReaderSession(api: Pick<ReturnType<typeof createReaderApi>, 'open' | 'renew'>, selector: ReaderSelector) {
  const {accountId, issueNumber, series, contentLocale} = selector;
  const [state, setState] = useState<{value: OnlineBulletinAccess | null; offline: boolean; validating?: boolean; error: 'unavailable' | 'updateRequired' | null}>({value: null, offline: false, error: null});
  const [attempt, setAttempt] = useState(0);
  const [loginRequired, setLoginRequired] = useState(false);
  const requestId = useRef<string | null>(null);
  const highWater = useRef(0);
  const blocked = useRef(false);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const bound = {accountId, issueNumber, series, contentLocale};
    const refresh = () => {
      if (document.visibilityState === 'hidden' || blocked.current) return;
      requestId.current = null;
      setState(previous => ({...previous, validating: true, error: null})); retry();
    };
    const stop = watchOfflineAccount(active => {
      if (active === accountId) return;
      blocked.current = true; controller.abort();
      setState({value: null, offline: false, error: 'unavailable'});
    });
    const stopEdition = watchOfflineEdition(bound, () => {
      controller.abort(); requestId.current = null;
      setState({value: null, offline: false, error: 'unavailable'});
    });
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    if (!blocked.current) void (async () => {
      const supported = supportsOfflineReader();
      const saved = supported ? await readOfflineSave(bound).catch(() => null) : null;
      const owner = supported ? await getOfflineIdentity().catch(() => null) : null;
      controller.signal.throwIfAborted();
      requestId.current ??= crypto.randomUUID();
      try {
        const value = saved ? await api.renew(bound, saved.save.value, requestId.current, controller.signal)
          : await api.open(bound, {clientRequestId: requestId.current}, controller.signal);
        controller.signal.throwIfAborted();
        if (owner?.accountId === accountId) {
          const current = await getOfflineIdentity();
          if (current.accountId !== accountId || current.epoch !== owner.epoch) throw new Error('offline_account_changed');
        }
        if (saved) await renewOfflineSave(bound, value, saved.save.epoch);
        controller.signal.throwIfAborted();
        highWater.current = Math.max(Date.now(), Date.parse(value.access.validatedAt));
        setLoginRequired(false);
        setState({value, offline: false, error: null});
      } catch (failure) {
        controller.signal.throwIfAborted();
        const action = readerFailureAction(failure);
        setLoginRequired(action === 'login');
        if (saved && action === 'purge') await removeOfflineSave(bound);
        if (saved && action === 'lock') await lockOfflineSave(bound);
        const retained = saved && (action === 'retain' || action === 'login') ? await readOfflineSave(bound) : null;
        controller.signal.throwIfAborted();
        if (retained?.status === 'available') {
          highWater.current = retained.save.lastObservedAt;
          setState({value: retained.save.value, offline: true, error: null});
        } else setState({value: null, offline: false, error: failure instanceof Error && failure.message === 'update_required' ? 'updateRequired' : 'unavailable'});
      }
    })().catch(() => {if (!controller.signal.aborted) setState({value: null, offline: false, error: 'unavailable'});});
    return () => {
      controller.abort(); stop(); stopEdition(); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh);
    };
  }, [api, accountId, issueNumber, series, contentLocale, attempt, retry]);

  const allowAction = useCallback(() => {
    const value = state.value;
    const now = Date.now();
    if (!value || blocked.current || state.validating) return false;
    if (now < highWater.current || now >= Date.parse(value.access.offlineValidUntil)) {
      setState({value: null, offline: false, error: 'unavailable'});
      if (supportsOfflineReader()) void lockOfflineSave({accountId, issueNumber, series, contentLocale}).catch(() => {});
      return false;
    }
    highWater.current = now;
    // Persist observed time without extending the server receipt.
    if (state.offline) void checkOfflineSave({accountId, issueNumber, series, contentLocale}, value.access.revision, now).then(status => {
      if (status !== 'available') setState({value: null, offline: false, error: 'unavailable'});
    }).catch(() => setState({value: null, offline: false, error: 'unavailable'}));
    return true;
  }, [state.value, state.offline, state.validating, accountId, issueNumber, series, contentLocale]);
  useEffect(() => {
    if (!state.value) return;
    const timeout = window.setTimeout(allowAction, Math.max(0, Date.parse(state.value.access.offlineValidUntil) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [state.value, allowAction]);
  const acceptSaved = useCallback((value: OnlineBulletinAccess) => {
    if (blocked.current) return;
    verifyReaderAccess(value, {accountId, issueNumber, series, contentLocale});
    highWater.current = Math.max(Date.now(), Date.parse(value.access.validatedAt));
    setState({value, offline: false, error: null});
  }, [accountId, issueNumber, series, contentLocale]);
  const privateFailure = useCallback((failure: unknown) => {
    if (!(failure instanceof HhcWebApiError || failure instanceof AccountSessionError || failure instanceof TypeError || failure instanceof Error && failure.message === 'invalid_reader_binding')) return;
    const action = readerFailureAction(failure);
    if (action === 'retain') return;
    if (action === 'login') {setLoginRequired(true); if (state.offline) return;}
    setState({value: null, offline: false, error: 'unavailable'});
    if (supportsOfflineReader() && (action === 'purge' || action === 'lock')) void (action === 'purge' ? removeOfflineSave : lockOfflineSave)({accountId, issueNumber, series, contentLocale}).catch(() => {});
  }, [accountId, issueNumber, series, contentLocale, state.offline]);
  return {...state, retry, allowAction, acceptSaved, loginRequired, privateFailure};
}
