'use client';
import {useEffect, useState} from 'react';
import {useAccountIdentity} from '@/components/layout/AccountControl';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';
import {getOfflineIdentity, listOfflineSaves, readOfflineSave, removeOfflineSave, supportsOfflineReader, type OfflineSave} from '@/features/weekly-reader/offline-store';
import {watchOfflineAccount} from '@/features/weekly-reader/offline-session';
import type {Locale} from '@/i18n/locales';
import {localeLabels} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import type {ReaderMessages} from './ReaderToolbar';
import './reader.css';

export function OfflineContentPage({locale, messages: m}: {locale: Locale; messages: ReaderMessages}) {
  const accountId = useAccountIdentity();
  const [items, setItems] = useState<{save: OfflineSave; available: boolean}[]>([]);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const enabled = isWeeklyReaderEnabled();
  useEffect(() => {
    if (!enabled || !supportsOfflineReader()) return;
    let active = true;
    const stop = watchOfflineAccount(() => {setItems([]); setRefresh(value => value + 1);});
    void (async () => {
      const owner = await getOfflineIdentity();
      if (!owner.accountId || accountId && owner.accountId !== accountId) return;
      const saved = await listOfflineSaves(owner.accountId);
      const rows = await Promise.all(saved.map(async save => ({save, available: (await readOfflineSave(save.selector))?.status === 'available'})));
      if (active) setItems(rows);
    })().catch(() => {if (active) setError(true);});
    return () => {active = false; stop();};
  }, [accountId, enabled, refresh]);
  async function remove(save: OfflineSave) {
    if (!window.confirm(m.offlineRemoveConfirm)) return;
    try {await removeOfflineSave(save.selector); setItems(rows => rows.filter(row => row.save !== save));}
    catch {setError(true);}
  }
  return <main className="weekly-reader">
    <a className="reader-back" href={`/${locale}/literature-ministry`}>{m.back}</a><h1>{m.offlineContent}</h1>
    {!enabled ? <p>{m.unavailable}</p> : !items.length ? <p>{m.offlineEmpty}</p> : <ul className="reader-offline-list">{items.map(({save, available}) => <li key={`${save.value.access.documentId}:${save.value.access.revision}`}>
      <a href={`/${locale}/literature-ministry/${save.selector.issueNumber}/read/${save.selector.series}/${save.selector.contentLocale}`}>{save.selector.issueNumber} · {getMessages(locale).literatureMinistry[save.selector.series]} · {localeLabels[save.selector.contentLocale]}</a>
      <p>{m.offlineRevision} {save.value.access.revision} · {m.offlineSize} {new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(save.size / 1024)} KB</p>
      <p>{m.offlineExpiry} {new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short'}).format(new Date(save.value.access.offlineValidUntil))}</p>
      {!available ? <p>{m.offlineLocked}</p> : null}
      <button type="button" onClick={() => void remove(save)}>{m.removeOffline}</button>
    </li>)}</ul>}
    {error ? <p role="alert">{m.offlineError}</p> : null}
  </main>;
}
