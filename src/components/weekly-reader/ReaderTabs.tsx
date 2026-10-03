import {useEffect, useState} from 'react';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import {Home, X, CloudCheck, CloudUpload, CloudOff, CloudAlert} from 'lucide-react';
import type {ReaderSyncStatus} from '@/features/weekly-reader/sync';
import {addTab, closeTab, readTabs, writeTabs, tabHref, tabKey, type ReaderTab} from '@/features/weekly-reader/workspace';
import type {Locale} from '@/i18n/locales';
import type {ReaderMessages} from './ReaderToolbar';

export function ReaderTabs({accountId, locale, current, title, messages: m, beforeNavigate, syncStatus, onSyncDetails}: {accountId: string; locale: Locale; current: ReaderTab; title?: string; messages: ReaderMessages; beforeNavigate?: () => Promise<boolean>; syncStatus?: ReaderSyncStatus; onSyncDetails?: (target: Element) => void}) {
  const [tabs, setTabs] = useState<ReaderTab[]>([current]);
  const [busy, setBusy] = useState(false);
  const key = tabKey(current);
  const {issueNumber, series, contentLocale} = current;
  useEffect(() => {
    const next = addTab(readTabs(accountId), {issueNumber, series, contentLocale});
    writeTabs(accountId, next);
    const frame = requestAnimationFrame(() => setTabs(next));
    return () => cancelAnimationFrame(frame);
  }, [accountId, issueNumber, series, contentLocale]);
  async function navigate(href: string, next?: ReaderTab[]) {
    if (busy) return;
    setBusy(true);
    try {
      if (beforeNavigate && !await beforeNavigate()) return;
      if (next) {writeTabs(accountId, next); setTabs(next);}
      window.location.assign(href);
    } finally {setBusy(false);}
  }
  const home = `/${locale}/literature-ministry`;
  const syncLabel = syncStatus ? ({synced: m.syncSynced, syncing: m.syncSyncing, waiting: m.syncWaiting, action: m.syncAction, paused: m.syncPaused})[syncStatus] : '';
  const SyncIcon = syncStatus === 'synced' ? CloudCheck : syncStatus === 'syncing' ? CloudUpload : syncStatus === 'waiting' ? CloudOff : CloudAlert;
  return <header className="reader-tabbar">
    <IconButton variant="ghost" icon={<Home size={21} aria-hidden="true"/>} aria-label={m.home} title={m.home} isDisabled={busy} onPress={() => void navigate(home)}/>
    <nav className="reader-tabs" aria-label={m.openBulletins}>
      {tabs.map(tab => {
        const id = tabKey(tab), active = id === key;
        const label = `${tab.issueNumber} · ${tab.series === 'children' ? m.childrenEdition : m.generalEdition} · ${tab.contentLocale}`;
        return <div key={id} className="reader-tab" data-active={active || undefined}>
          <a href={tabHref(locale, tab)} aria-current={active ? 'page' : undefined} title={active && title ? title : label} onClick={event => {event.preventDefault(); if (!active) void navigate(tabHref(locale, tab));}}>
            {active && title ? <h1 lang={tab.contentLocale}>{title}</h1> : label}
          </a>
          {active && syncStatus ? <span className="reader-tab-sync" data-sync={syncStatus}><IconButton variant="ghost" icon={<SyncIcon size={18} aria-hidden="true"/>} aria-label={syncLabel} title={syncLabel} onPress={event => onSyncDetails?.(event.target)}/></span> : null}
          <IconButton variant="ghost" icon={<X size={16} aria-hidden="true"/>} aria-label={`${m.closeTab} ${label}`} title={m.closeTab} isDisabled={busy} onPress={() => {
            const result = closeTab(tabs, key, id);
            if (active) void navigate(result.active ? tabHref(locale, result.active) : home, result.tabs);
            else {writeTabs(accountId, result.tabs); setTabs(result.tabs);}
          }}/>
        </div>;
      })}
    </nav>
  </header>;
}
