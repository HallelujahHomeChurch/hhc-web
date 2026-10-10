'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {LoadMoreTrigger} from '@hallelujahhomechurch/ui';
import type {RecordingWatchView} from '@hallelujahhomechurch/hhc-web-client';
import type {Locale} from '@/i18n/locales';
import type {createMemberVideoApi} from './api';
import {BroadcastCover} from './BroadcastWaitingPanel';
import {broadcastLabels,broadcastPollDelay} from './broadcast';
import styles from './MemberVideoZone.module.css';

export function UpcomingBroadcasts({api,locale,full,loading,retry,loadMoreLabel='Load more',onPresenceChange}:{api:ReturnType<typeof createMemberVideoApi>;locale:Locale;full:boolean;loading:string;retry:string;loadMoreLabel?:string;onPresenceChange?:(present:boolean)=>void}) {
 const [items,setItems]=useState<RecordingWatchView[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState(false),[refresh,setRefresh]=useState(0);
 const more=useRef<AbortController|null>(null),pages=useRef(1),busy=useRef(false);
 const labels=broadcastLabels[locale];
 useEffect(()=>{
  const controller=new AbortController();let timer=0,inFlight=false,failures=0;
  const load=async()=>{
   if(inFlight)return;
   if(busy.current){timer=window.setTimeout(()=>void load(),15000);return;}
   inFlight=true;busy.current=true;
   try{
    let page=await api.upcoming({limit:full?12:3,signal:controller.signal});
    const refreshed=[...page.items];
    for(let n=1;n<pages.current&&page.nextCursor;n++){
     const previous=page.nextCursor;
     page=await api.upcoming({limit:12,cursor:previous,signal:controller.signal});
     if(page.nextCursor===previous)throw new Error('Broadcast cursor did not advance');
     refreshed.push(...page.items);
    }
    if(controller.signal.aborted)return;
    onPresenceChange?.(refreshed.length>0);
    setItems([...new Map(refreshed.map(item=>[item.recordingId,item])).values()]);
    setCursor(page.nextCursor);setError(false);failures=0;
   }catch{if(!controller.signal.aborted){setError(true);failures++;}}
   finally{inFlight=false;busy.current=false;if(!controller.signal.aborted)timer=window.setTimeout(()=>void load(),broadcastPollDelay('waiting',document.hidden,failures));}
  };
  const foreground=()=>{if(!document.hidden){window.clearTimeout(timer);void load();}};
  void load();document.addEventListener('visibilitychange',foreground);
  return()=>{controller.abort();more.current?.abort();window.clearTimeout(timer);document.removeEventListener('visibilitychange',foreground);};
 },[api,full,refresh,onPresenceChange]);
 const loadMore=async()=>{
  if(!cursor||busy.current)return;
  busy.current=true;
  setPending(true);const controller=new AbortController();more.current=controller;
  try{
   const page=await api.upcoming({limit:12,cursor,signal:controller.signal});
   if(controller.signal.aborted)return;
   if(page.nextCursor===cursor)throw new Error('Broadcast cursor did not advance');
   setItems(current=>{const map=new Map(current.map(item=>[item.recordingId,item]));for(const item of page.items)map.set(item.recordingId,item);return [...map.values()];});
   pages.current++;setCursor(page.nextCursor);setError(false);
  }catch{if(!controller.signal.aborted)setError(true);}
  finally{busy.current=false;if(!controller.signal.aborted)setPending(false);}
 };
 return <>
  {items.map(item=><article key={item.recordingId} className={styles.card}>
   <Link href={`/${locale}/member-videos/${item.recordingId}`} className={styles.thumbnail} aria-hidden="true" tabIndex={-1}>
    <BroadcastCover api={api} id={item.recordingId} title={item.title} revision={item.stateRevision}/>
    <span className={`${styles.badge} ${styles.stateBadge}`}>{labels.upcoming}</span>
   </Link>
   <div className={styles.info}><h3 className={styles.title}><Link href={`/${locale}/member-videos/${item.recordingId}`}>{item.title}</Link></h3>
    {item.scheduledAt?<p className={styles.date}><time dateTime={item.scheduledAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Taipei'}).format(new Date(item.scheduledAt))}</time></p>:null}
   </div>
  </article>)}
  {!full&&cursor?<Link href={`/${locale}/member-videos?upcoming=1`} className="col-span-full min-h-11 text-primary underline">{labels.all}</Link>:null}
  {full&&cursor?<div className="col-span-full"><LoadMoreTrigger hasMore loading={pending} error={error} onLoadMore={loadMore} labels={{loadMore:loadMoreLabel,loading,retry}}/></div>:null}
  {error&&(!full||!cursor)?<button className="col-span-full min-h-11 text-primary underline" onClick={()=>setRefresh(n=>n+1)}>{retry}</button>:null}
  {full&&!error&&!pending&&!items.length?<p className="col-span-full text-muted">{labels.empty}</p>:null}
 </>;
}
