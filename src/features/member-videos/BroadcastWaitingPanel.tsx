'use client';

import {VideoInteractions} from './VideoInteractions';
import {useCallback,useEffect,useState} from 'react';
import type {RecordingWatchView} from '@hallelujahhomechurch/hhc-web-client';
import type {Locale} from '@/i18n/locales';
import {broadcastLabels,countdownSeconds} from './broadcast';
import {LiveCoverSurface} from './RecordingCover';
import type {createMemberVideoApi} from './api';
import {usePrivateCover} from '@/lib/use-private-cover';
import zoneStyles from './MemberVideoZone.module.css';

export function BroadcastCover({api,id,title,revision}:{api:ReturnType<typeof createMemberVideoApi>;id:string;title:string;revision:string|number}) {
 const load=useCallback((signal:AbortSignal)=>api.broadcastCover(id,signal),[api,id]);
 const url=usePrivateCover({scope:api,resource:`broadcast:${id}`,revision:String(revision),load});
 return <LiveCoverSurface url={url} title={title}/>;
}
export function BroadcastWaitingPanel({watch,locale,api}:{watch:RecordingWatchView;locale:Locale;api:ReturnType<typeof createMemberVideoApi>}) {
 const labels=broadcastLabels[locale];
 const [elapsed,setElapsed]=useState({serverNow:watch.serverNow,seconds:0});
 useEffect(()=>{const start=performance.now();const timer=window.setInterval(()=>setElapsed({serverNow:watch.serverNow,seconds:(performance.now()-start)/1000}),1000);return()=>window.clearInterval(timer);},[watch.serverNow]);
 const seconds=countdownSeconds(watch.scheduledAt,watch.serverNow,elapsed.serverNow===watch.serverNow?elapsed.seconds:0);
 const clock=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,'0')).join(':');
 const message=watch.view==='waiting'?(seconds>0?labels.startsIn.replace('{time}',clock):labels.waiting):watch.view==='processing'?labels.processing:watch.view==='cancelled'?labels.cancelled:labels.unavailable;
 return <div className={`${zoneStyles.video} grid min-w-0 gap-4`}>
  <div className="relative isolate grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-neutral-950 text-white">
   <div className="absolute inset-0 -z-10" aria-hidden="true"><BroadcastCover key={`${watch.recordingId}:${watch.stateRevision}`} api={api} id={watch.recordingId} title={watch.title} revision={watch.cover?`cover:${watch.cover.revision}`:`state:${watch.stateRevision}`}/></div>
   <p className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-4 py-2 text-center" role="status" aria-live={seconds>0?'off':'polite'}>{message}</p>
  </div>
  <h1 className="text-2xl font-semibold text-ink">{watch.title}</h1>
  <VideoInteractions api={api} id={watch.recordingId} title={watch.title} locale={locale} live description={watch.description} date={watch.scheduledAt} dateKind="scheduled"/>
 </div>;
}
