'use client';
import {useEffect, useRef, useState} from 'react';
import type {OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from '@/features/weekly-reader/api';
import {commitOfflineSave, getOfflineIdentity, hasPendingReaderWrites, readOfflineSave, removeOfflineSave, stageOfflineSave, supportsOfflineReader, type OfflineSave} from '@/features/weekly-reader/offline-store';
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
      if (active) {setSaved(result?.save ?? null); setReady(true);}
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
  async function remove() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const pending = await hasPendingReaderWrites(accountId, value.document.documentId);
      if (!window.confirm(pending ? m.unsyncedWarning : m.offlineRemoveConfirm)) return;
      await removeOfflineSave(selector); setSaved(null);
    }
    catch {setError(true);}
    finally {setBusy(false);}
  }
  return <div className="reader-offline-control">
    <button type="button" disabled={busy} onClick={() => void (saved ? remove() : save())}>{busy ? m.savingOffline : saved ? m.removeOffline : m.saveOffline}</button>
    <a href={`/${locale}/literature-ministry/offline`}>{m.offlineContent}</a>
    {saved ? <span>{m.offlineRevision} {saved.value.access.revision} · {m.offlineSize} {new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(saved.size / 1024)} KB · {m.offlineExpiry} {new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short'}).format(new Date(saved.value.access.offlineValidUntil))}</span> : null}
    {value.access.currentRevision > value.access.revision ? <p role="status">{m.offlineUpdate}</p> : null}
    {error ? <p role="alert">{m.offlineError}</p> : null}
  </div>;
}
