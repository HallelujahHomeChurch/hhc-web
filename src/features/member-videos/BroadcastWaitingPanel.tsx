'use client';

import {useEffect,useState} from 'react';
import type {RecordingWatchView} from '@hallelujahhomechurch/hhc-web-client';
import type {Locale} from '@/i18n/locales';
import {broadcastLabels,countdownSeconds} from './broadcast';
import {LiveCoverSurface} from './RecordingCover';
import type {createMemberVideoApi} from './api';
import zoneStyles from './MemberVideoZone.module.css';

export function BroadcastCover({api,id,title,revision}:{api:ReturnType<typeof createMemberVideoApi>;id:string;title:string;revision:number}) {
 const [value,setValue]=useState<{id:string;revision:number;url:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();let objectURL:string|undefined;
  void api.broadcastCover(id,controller.signal).then(blob=>{if(!controller.signal.aborted){objectURL=URL.createObjectURL(blob);setValue({id,revision,url:objectURL});}}).catch(()=>{});
  return()=>{controller.abort();if(objectURL)URL.revokeObjectURL(objectURL);};
 },[api,id,revision]);
 return <LiveCoverSurface url={value?.id===id&&value.revision===revision?value.url:undefined} title={title}/>;
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
   <div className="absolute inset-0 -z-10" aria-hidden="true"><BroadcastCover key={`${watch.recordingId}:${watch.stateRevision}`} api={api} id={watch.recordingId} title={watch.title} revision={watch.stateRevision}/></div>
   <p className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-4 py-2 text-center" role="status" aria-live={seconds>0?'off':'polite'}>{message}</p>
  </div>
  <h1 className="text-2xl font-semibold text-ink">{watch.title}</h1>
  {watch.scheduledAt?<p className="text-sm text-muted"><time dateTime={watch.scheduledAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Taipei'}).format(new Date(watch.scheduledAt))}</time></p>:null}
  {watch.description?<p className="whitespace-pre-wrap break-words rounded-xl bg-panel p-4 text-ink">{watch.description}</p>:null}
 </div>;
}
