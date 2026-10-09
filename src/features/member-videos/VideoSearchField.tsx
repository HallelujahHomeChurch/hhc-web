'use client';
import {useRouter} from 'next/navigation';
import {ExpandableSearchField,type ExpandableSearchFieldProps} from '@hallelujahhomechurch/ui';
import type {Locale} from '@/i18n/locales';
import {forgetVideoPosition,parseVideoQuery,videoSearchHref,videoSearchRefreshEvent} from './search';

export function VideoSearchField({locale,query,isLibrary,...props}:Omit<ExpandableSearchFieldProps,'onSubmit'|'defaultValue'|'allowEmptySubmit'> & {locale:Locale;query:string;isLibrary:boolean}) {
  const router=useRouter();
  return <ExpandableSearchField {...props} defaultValue={query} allowEmptySubmit onSubmit={draft=>{
    const next=parseVideoQuery(draft).query;
    forgetVideoPosition();
    if(isLibrary&&next===query){window.dispatchEvent(new Event(videoSearchRefreshEvent));window.scrollTo({top:0});}
    else router.push(videoSearchHref(locale,next));
  }}/>;
}
