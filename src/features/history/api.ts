import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import {formatContentDate, getContentLocaleMetadata} from '@/features/content/locale';
import type {Locale} from '@/i18n/locales';
import type {HistoryTimelinePage, HistoryTimelinePayload} from './types';

export async function getHistoryTimeline(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<HistoryTimelinePayload> {
  const values = [] as Awaited<ReturnType<HhcWebClient['listPublicContent']>>;
  const pageSize = 100;
  for (let page = 1; ; page += 1) {
    const result = await client.listPublicContentPage('history', locale, {page, pageSize});
    values.push(...result.data);
    if (values.length >= result.meta.total || result.data.length === 0) break;
  }
  return {events: mapHistory(values, locale)};
}

export async function getHistoryTimelinePage(locale: Locale, page: number, pageSize: number, client: HhcWebClient = publicContentClient()): Promise<HistoryTimelinePage> {
  const result = await client.listPublicContentPage('history', locale, {page, pageSize});
  return {events: mapHistory(result.data, locale), meta: result.meta};
}

function mapHistory(values: Awaited<ReturnType<HhcWebClient['listPublicContent']>>, locale: Locale) {
  return values.map((value) => {
    const metadata = getContentLocaleMetadata(locale, value);
    return {
      ...metadata,
      date: formatContentDate(value.eventDate ?? '', metadata.resolvedLocale) || value.dateLabel || '',
      body: value.body ?? ''
    };
  });
}
