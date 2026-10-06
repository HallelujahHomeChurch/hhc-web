'use client';

import {useEffect,useState} from 'react';
import {Play} from 'lucide-react';
import type {createMemberVideoApi} from './api';

type CoverApi=ReturnType<typeof createMemberVideoApi>;

// Keep private bytes local to this mounted viewer; never use the public image
// optimizer, persistent storage, or playback grants for a cover.
export function useRecordingCover(api:CoverApi,id:string|undefined,expiresAt?:string|null,revision?:string) {
  const [value,setValue]=useState<{api:CoverApi;id:string;url:string;revision?:string}|null>(null);
  useEffect(()=>{
    if(!id) return;
    const controller=new AbortController();
    let url='';
    const release=()=>{
      controller.abort();
      if(url) {URL.revokeObjectURL(url);url='';}
    };
    const expired=()=>Boolean(expiresAt&&Date.parse(expiresAt)<=Date.now());
    if(expired()) return;
    void api.cover(id,controller.signal).then(blob=>{
      if(controller.signal.aborted||expired()) return;
      url=URL.createObjectURL(blob);
      setValue({api,id,url,revision});
    }).catch(()=>{ /* Optional image failure keeps the existing video placeholder. */ });
    const timer=window.setInterval(()=>{
      if(expired()) {release();setValue(null);window.clearInterval(timer);}
    },60_000);
    return ()=>{release();window.clearInterval(timer);};
  },[api,id,expiresAt,revision]);
  return value?.api===api&&value.id===id&&value.revision===revision ? value.url:undefined;
}

export function RecordingCover({api,id,title,expiresAt,revision}:{api:CoverApi;id:string;title:string;expiresAt?:string|null;revision?:string}) {
  const url=useRecordingCover(api,id,expiresAt,revision);
  return <div className="grid aspect-video place-items-center overflow-hidden rounded-lg bg-neutral-950 text-white">
    {/* Authenticated object URLs must not pass through Next's public optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url ? <img src={url} alt={title} width={1280} height={720} loading="lazy" className="h-full w-full object-cover"/>:<Play size={28} aria-hidden="true"/>}
  </div>;
}
