'use client';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AlertDialog} from '@hallelujahhomechurch/ui';
import {useAccountIdentity} from '@/components/layout/AccountControl';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';
import {getOfflineIdentity, readOfflineRemovalSnapshot, listOfflineSaves, readOfflineSave, removeOfflineSave, supportsOfflineReader, type OfflineRemovalSnapshot, type OfflineSaveSummary} from '@/features/weekly-reader/offline-store';
import {watchOfflineAccount} from '@/features/weekly-reader/offline-session';
import type {Locale} from '@/i18n/locales';
import {localeLabels} from '@/i18n/locales';
import type {ReaderMessages} from './ReaderToolbar';
import './reader.css';

export type BulletinSeriesLabels = {general: string; children: string};

export function OfflineContentPage({locale, messages: m, seriesLabels}: {locale: Locale; messages: ReaderMessages; seriesLabels: BulletinSeriesLabels}) {
  const accountId = useAccountIdentity();
  return <OfflineContentList key={accountId ?? ''} accountId={accountId} locale={locale} messages={m} seriesLabels={seriesLabels}/>;
}

function OfflineContentList({accountId, locale, messages: m, seriesLabels}: {accountId: string | null; locale: Locale; messages: ReaderMessages; seriesLabels: BulletinSeriesLabels}) {
  const [savedItems, setItems] = useState<{save: OfflineSaveSummary; available: boolean}[]>([]);
  // Auth can change before the asynchronous offline-account purge completes.
  const items = savedItems.filter(({save}) => !accountId || save.selector.accountId === accountId);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const enabled = isWeeklyReaderEnabled();
  const [decision, setDecision] = useState<{save: OfflineSaveSummary; snapshot: OfflineRemovalSnapshot} | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false), generation = useRef(0), mounted = useRef(false);
  useLayoutEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    if (!enabled || !supportsOfflineReader()) return;
    let active = true;
    const request = generation.current;
    const stop = watchOfflineAccount(() => {generation.current++; setDecision(null); pending.current = false; setBusy(false); setItems([]); setRefresh(value => value + 1);});
    void (async () => {
      const owner = await getOfflineIdentity();
      if (!owner.accountId || accountId && owner.accountId !== accountId) return;
      const saved = await listOfflineSaves(owner.accountId);
      const rows = await Promise.all(saved.map(async save => ({save, available: (await readOfflineSave(save.selector))?.status === 'available'})));
      if (active && request === generation.current) setItems(rows);
    })().catch(() => {if (active && request === generation.current) setError(true);});
    return () => {active = false; stop();};
  }, [accountId, enabled, refresh]);
  async function remove(save: OfflineSaveSummary) {
    if (pending.current || decision) return;
    const request = generation.current;
    pending.current = true; setBusy(true); setError(false);
    try {
      const snapshot = await readOfflineRemovalSnapshot(save.selector);
      if (!mounted.current || request !== generation.current) return;
      if (snapshot.documentId !== save.documentId || snapshot.revision !== save.revision) throw new Error('offline_replica_changed');
      setDecision({save, snapshot});
    } catch {if (mounted.current && request === generation.current) {setError(true); setRefresh(value => value + 1);}}
    finally {if (mounted.current && request === generation.current) {pending.current = false; setBusy(false);}}
  }
  async function confirmRemoval() {
    if (!decision || pending.current) return;
    const request = generation.current;
    pending.current = true; setBusy(true);
    try {
      await removeOfflineSave(decision.save.selector, decision.snapshot);
      if (mounted.current && request === generation.current) setItems(rows => rows.filter(row => row.save !== decision.save));
    } catch {if (mounted.current && request === generation.current) {setError(true); setRefresh(value => value + 1);}}
    finally {if (mounted.current && request === generation.current) {setDecision(null); pending.current = false; setBusy(false);}}
  }
  return <main className="weekly-reader">
    <AlertDialog isOpen={!!decision} title={m.removeOffline} description={<span ref={node => {const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay'); if (overlay) overlay.dataset.readerExit = '';}}>{decision?.snapshot.pending ? m.unsyncedWarning : m.offlineRemoveConfirm}</span>} cancelLabel={m.noteCancel} closeLabel={m.close} confirmLabel={m.removeOffline} confirmVariant="danger" onConfirm={confirmRemoval} onOpenChange={open => {if (!open && !pending.current) setDecision(null);}}/>
    <a className="reader-back" href={`/${locale}/literature-ministry`}>{m.back}</a><h1>{m.offlineContent}</h1>
    {!enabled ? <p>{m.unavailable}</p> : !items.length ? <p>{m.offlineEmpty}</p> : <ul className="reader-offline-list">{items.map(({save, available}) => <li key={`${save.documentId}:${save.revision}`}>
      <a href={`/${locale}/literature-ministry/${save.selector.issueNumber}/read/${save.selector.series}/${save.selector.contentLocale}`}>{save.selector.issueNumber} · {seriesLabels[save.selector.series]} · {localeLabels[save.selector.contentLocale]}</a>
      <p>{m.offlineRevision} {save.revision} · {m.offlineSize} {new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(save.size / 1024)} KB</p>
      <p>{m.offlineExpiry} {new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short'}).format(new Date(save.offlineValidUntil))}</p>
      {!available ? <p>{m.offlineLocked}</p> : null}
      <button type="button" disabled={busy || !!decision} onClick={() => void remove(save)}>{m.removeOffline}</button>
    </li>)}</ul>}
    {error ? <p role="alert">{m.offlineError}</p> : null}
  </main>;
}
