'use client';
import {Save, Check, LoaderCircle} from 'lucide-react';
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
  const [saved, setSaved] = useState<OfflineSave | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const {accountId, issueNumber, series, contentLocale} = selector;
  useEffect(() => {
    let active = true;
    if (supportsOfflineReader() && 'serviceWorker' in navigator && typeof MessageChannel !== 'undefined') void readOfflineSave({accountId, issueNumber, series, contentLocale}).then(result => {
      if (active) {setSaved(result?.status === 'available' ? result.save : null); setReady(true);}
    }).catch(() => {});
    return () => {active = false; controller.current?.abort();};
  }, [accountId, issueNumber, series, contentLocale, value.access.receiptId]);
  if (!ready) return null;
  async function save() {
    if (busy) return;
    setBusy(true); setError(false);
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
    } catch (failure) {if (!request.signal.aborted) {setError(true); onFailure(failure);}}
    finally {if (!request.signal.aborted) setBusy(false);}
  }
  const complete = saved?.value.access.revision === value.access.revision;
  const label = busy ? m.savingOffline : complete ? m.savedOffline : m.saveOffline;
  return <div className="reader-offline-control" aria-busy={busy}>
    <ReaderIconButton variant="ghost" aria-label={label} title={label} isDisabled={busy || complete} onPress={() => void save()} icon={busy ? <LoaderCircle size={20} className="reader-saving-spinner" aria-hidden="true"/> : complete ? <Check size={20} aria-hidden="true"/> : <Save size={20} aria-hidden="true"/>}/>
    {error ? <p role="alert">{m.offlineError}</p> : null}
  </div>;
}
