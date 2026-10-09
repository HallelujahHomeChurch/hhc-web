import type {Locale} from '@/i18n/locales';

export const videoSearchRefreshEvent = 'hhc:member-videos-search';
export type VideoSearchLabels = {results:string; empty:string; clear:string; tooLong:string};
export function parseVideoQuery(value?:string|string[]) {
  const query = (Array.isArray(value) ? value[0] ?? '' : value ?? '').replace(/\p{White_Space}+/gu,' ').trim().toLowerCase();
  return {query, invalid:Array.isArray(value)||Array.from(query).length>100||query.includes('\0')};
}
export function videoSearchHref(locale:Locale,query:string) {
  const path=`/${locale}/member-videos`;
  return query ? `${path}?${new URLSearchParams({q:query})}` : path;
}
