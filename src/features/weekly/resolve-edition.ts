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
  for (const locale of candidates) {
    if (!authorizedEditions.some(edition => edition.series === series && edition.locale === locale)) continue;
    const version = publishedEditions.find(edition => edition.series === series && edition.locale === locale && (edition.pdfPublished !== false || edition.onlineRevision));
    if (version) return {issueId: version.issueId, series, contentLocale: locale, canDownload: version.pdfPublished !== false, readUrl: readerUrl(uiLocale, version), version};
  }
  return null;
}
