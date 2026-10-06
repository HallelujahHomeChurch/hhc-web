import type {BulletinEdition, BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';
import type {Locale} from '@/i18n/locales';
import type {WeeklyBulletin} from './types';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';

export function readerUrl(uiLocale: Locale, version: WeeklyBulletin): string | undefined {
  if (!isWeeklyReaderEnabled() || !version.onlineRevision || !version.issueNumber) return undefined;
  return `/${uiLocale}/literature-ministry/${version.issueNumber}/read/${version.series}/${version.locale}`;
}

export function resolveEdition({uiLocale, series, authorizedEditions, publishedEditions}: {
  uiLocale: Locale;
  series: BulletinSeries;
  authorizedEditions: readonly BulletinEdition[];
  publishedEditions: readonly WeeklyBulletin[];
}) {
  const candidates: BulletinLocale[] = uiLocale === 'en' || uiLocale === 'zh-Hans' ? [uiLocale, 'zh-Hant'] : ['zh-Hant'];
  const available = candidates.flatMap(locale => authorizedEditions.some(edition => edition.series === series && edition.locale === locale)
    ? publishedEditions.filter(edition => edition.series === series && edition.locale === locale && (edition.pdfPublished !== false || edition.onlineRevision)) : []);
  const version = available[0];
  if (!version) return null;
  const downloadVersion = available.find(edition => edition.pdfPublished !== false);
  const readVersion = available.find(edition => readerUrl(uiLocale, edition));
  return {issueId: version.issueId, series, contentLocale: version.locale, canDownload: Boolean(downloadVersion), downloadVersion, readVersion, readUrl: readVersion && readerUrl(uiLocale, readVersion), version};
}
