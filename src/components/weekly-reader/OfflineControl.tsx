'use client';
import {Save, Check, LoaderCircle, CircleAlert} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import {useEffect, useRef, useState} from 'react';
import type {OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from '@/features/weekly-reader/api';
import {commitOfflineSave, getOfflineIdentity, readOfflineSave, stageOfflineSave, supportsOfflineReader, type OfflineSave} from '@/features/weekly-reader/offline-store';
import type {Locale} from '@/i18n/locales';
import {prepareOfflineReaderShell} from '@/lib/reader-shell';
import type {ReaderMessages} from './ReaderToolbar';

export function OfflineControl({api, value, selector, locale, messages: m, onSaved, onFailure}: {
  api: Pick<ReturnType<typeof createReaderApi>, 'renew'>; value: OnlineBulletinAccess; selector: ReaderSelector; locale: Locale; messages: ReaderMessages; onSaved: (value: OnlineBulletinAccess) => void; onFailure: (error: unknown) => void;
}) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<OfflineSave | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'save' | 'recovery' | null>(null);
  const controller = useRef<AbortController | null>(null);
  const {accountId, issueNumber, series, contentLocale} = selector;
  const supported = supportsOfflineReader() && 'serviceWorker' in navigator && typeof MessageChannel !== 'undefined';
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {if (active) {active = false; setInitError(true); setReady(false);}}, 20000);
    if (supported) void readOfflineSave({accountId, issueNumber, series, contentLocale}).then(result => {
      if (active) {setSaved(result?.status === 'available' ? result.save : null); setInitError(false); setReady(true);}
    }).catch(() => {if (active) {setInitError(true); setReady(false);}}).finally(() => clearTimeout(timer));
    else clearTimeout(timer);
    return () => {active = false; clearTimeout(timer); controller.current?.abort();};
  }, [accountId, issueNumber, series, contentLocale, value.access.receiptId, attempt, supported]);
  if (!supported) return null;
  if (!ready) return <div className="reader-offline-control">
    <ReaderIconButton variant="ghost" aria-label={initError ? m.offlineInitError : m.loading} title={initError ? m.offlineInitError : m.loading} isDisabled={!initError} onPress={() => {setInitError(false); setAttempt(value => value + 1);}} icon={initError ? <CircleAlert size={20} aria-hidden="true"/> : <LoaderCircle size={20} className="reader-saving-spinner" aria-hidden="true"/>}/>
    {initError ? <div role="alert"><p>{m.offlineInitError}</p><button type="button" onClick={() => {setInitError(false); setAttempt(value => value + 1);}}>{m.retry}</button></div> : null}
  </div>;
  async function save() {
    if (busy) return;
    setBusy(true); setError(null);
    const request = new AbortController(); controller.current = request;
    try {
      const owner = await getOfflineIdentity();
      if (owner.accountId !== accountId) throw new Error('offline_account_changed');
      const fresh = await api.renew(selector, value, crypto.randomUUID(), request.signal);
      const staged = await stageOfflineSave(fresh, selector, globalThis.fetch.bind(globalThis), Date.now(), request.signal);
      await prepareOfflineReaderShell(locale, request.signal);
      request.signal.throwIfAborted();
      await commitOfflineSave(staged, owner.epoch);
      request.signal.throwIfAborted();
      setSaved({...staged, epoch: owner.epoch}); onSaved(fresh);
    } catch (failure) {if (!request.signal.aborted) {setError(failure instanceof Error && failure.message === 'offline_pending_recovery' ? 'recovery' : 'save'); onFailure(failure);}}
    finally {if (!request.signal.aborted) setBusy(false);}
  }
  const complete = saved?.value.access.revision === value.access.revision;
  const label = busy ? m.savingOffline : complete ? m.savedOffline : m.saveOffline;
  return <div className="reader-offline-control" aria-busy={busy}>
    <ReaderIconButton variant="ghost" aria-label={label} title={label} isDisabled={busy || complete} onPress={() => void save()} icon={busy ? <LoaderCircle size={20} className="reader-saving-spinner" aria-hidden="true"/> : complete ? <Check size={20} aria-hidden="true"/> : <Save size={20} aria-hidden="true"/>}/>
    {error ? <p role="alert">{error === 'recovery' ? m.offlineRecoveryRequired : m.offlineError}</p> : null}
  </div>;
}
