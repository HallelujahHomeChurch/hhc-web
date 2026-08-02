import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import type {HistoryTimelinePage, HistoryTimelinePayload} from './types';

export async function getHistoryTimeline(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<HistoryTimelinePayload> {
  const values = await client.listPublicContent('history', locale);
  return {events: mapHistory(values, locale)};
}

export async function getHistoryTimelinePage(locale: Locale, page: number, pageSize: number, client: HhcWebClient = publicContentClient()): Promise<HistoryTimelinePage> {
  const result = await client.listPublicContentPage('history', locale, {page, pageSize});
  return {events: mapHistory(result.data, locale), meta: result.meta};
}

function mapHistory(values: Awaited<ReturnType<HhcWebClient['listPublicContent']>>, locale: Locale) {
  return values.map((value) => ({date: formatHistoryDate(value.eventDate ?? '', locale) || value.dateLabel || '', body: value.body ?? ''}));
}

function formatHistoryDate(value: string, locale: Locale): string {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value);
  if (!match) return '';
  const [, year, month, day] = match;
  if (!month) return year;
  if (locale !== 'en') return `${year}年${Number(month)}月${day ? `${Number(day)}日` : ''}`;
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: day ? 'numeric' : 'long',
    ...(day ? {day: 'numeric'} : {}),
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day ?? 1))));
}
