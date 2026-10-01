'use client';
import {useSyncExternalStore} from 'react';
import {bulletinEditions} from '@hallelujahhomechurch/preferences';
import type {Locale} from '@/i18n/locales';
import type {ReaderMessages} from './ReaderToolbar';
import {WeeklyReader} from './WeeklyReader';
import {OfflineContentPage} from './OfflineContentPage';

const subscribePath = (changed: () => void) => {window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed);};
const currentPath = () => window.location.pathname;
const serverPath = () => null;

export function OfflineReaderShell({locale, messages}: {locale: Locale; messages: ReaderMessages}) {
  const path = useSyncExternalStore(subscribePath, currentPath, serverPath);
  if (path === `/${locale}/literature-ministry/offline`) return <OfflineContentPage locale={locale} messages={messages}/>;
  const match = path?.match(/^\/(zh-Hant|zh-Hans|en|ja|ko)\/literature-ministry\/([1-9]\d{0,8})\/read\/(general|children)\/(zh-Hant|zh-Hans|en)$/);
  const edition = match && match[1] === locale ? bulletinEditions.find(edition => edition.series === match[3] && edition.locale === match[4]) : null;
  if (!match || !edition) return <main className="weekly-reader" role="status"><h1>{messages.title}</h1><p>{path === null ? messages.loading : messages.unavailable}</p><a href={`/${locale}/literature-ministry/offline`}>{messages.offlineContent}</a></main>;
  return <WeeklyReader locale={locale} issueNumber={Number(match[2])} series={edition.series} contentLocale={edition.locale} messages={messages}/>;
}
