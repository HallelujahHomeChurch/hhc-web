import type {Locale} from '@/i18n/locales';

export const videoSearchRefreshEvent = 'hhc:member-videos-search';
export type VideoSearchLabels = {results:string; empty:string; clear:string; back:string; tooLong:string};
export function parseVideoQuery(value?:string|string[]) {
  const query = (Array.isArray(value) ? value[0] ?? '' : value ?? '').replace(/\p{White_Space}+/gu,' ').trim().toLowerCase();
  return {query, invalid:Array.isArray(value)||Array.from(query).length>100||query.includes('\0')};
}
export function videoSearchHref(locale:Locale,query:string,id?:string) {
  const path=`/${locale}/member-videos${id ? `/${encodeURIComponent(id)}` : ''}`;
  return query ? `${path}?${new URLSearchParams({q:query})}` : path;
}

type Position = {batches:number;anchor:string;offset:number;scrollY:number};
let previous: (Position & {identity:string;locale:Locale;query:string;savedAt:number}) | null = null;
export function forgetVideoPosition(){previous=null;}
export function rememberVideoPosition(identity:string|null,locale:Locale,query:string,position:Position){
  if(!identity){forgetVideoPosition();return;}
  previous={...position,identity,locale,query,savedAt:Date.now()};
}
export function readVideoPosition(identity:string|null,locale:Locale,query:string){
  if(!identity){forgetVideoPosition();return null;}
  if (previous && (previous.identity!==identity||previous.locale!==locale||previous.query!==query||Date.now()-previous.savedAt>5*60_000)) previous=null;
  return previous ? {...previous} : null;
}
