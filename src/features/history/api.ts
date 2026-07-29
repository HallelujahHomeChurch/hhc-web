import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import type {HistoryTimelinePayload} from './types';

export async function getHistoryTimeline(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<HistoryTimelinePayload> {
  const values = await client.listPublicContent('history', locale);
  return {events: values.map((value) => ({date: value.dateLabel ?? '', body: value.body ?? ''}))};
}
