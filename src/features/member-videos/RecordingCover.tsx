'use client';

import {useEffect,useRef,useState,type RefObject} from 'react';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
import {Play} from 'lucide-react';
import type {createMemberVideoApi} from './api';

type CoverApi=ReturnType<typeof createMemberVideoApi>;

export function useLiveRecordingCover(api:CoverApi,recording:MemberLiveRecording,enabled=true){
  const {id,captureId,coverRevision,createdAt}=recording;
  const [value,setValue]=useState<{api:CoverApi;id:string;captureId:string;url:string}|null>(null);
  const current=useRef(value);
  useEffect(()=>()=>{if(current.current)URL.revokeObjectURL(current.current.url);current.current=null;},[]);
  useEffect(()=>{
    const abort=new AbortController();
    const expiresAt=Date.parse(createdAt)+24*60*60*1000;
    const expired=()=>!Number.isFinite(expiresAt)||expiresAt<=Date.now();
    const discard=()=>{if(current.current)URL.revokeObjectURL(current.current.url);current.current=null;setValue(null);};
    if(current.current&&(current.current.api!==api||current.current.id!==id||current.current.captureId!==captureId))discard();
    if(!enabled||expired()||!coverRevision){discard();return;}
    void api.liveCover(id,captureId,abort.signal).then(blob=>{
      if(abort.signal.aborted||expired())return;
      if(current.current)URL.revokeObjectURL(current.current.url);
      const next={api,id,captureId,url:URL.createObjectURL(blob)};current.current=next;setValue(next);
    }).catch((error:unknown)=>{
      if(abort.signal.aborted)return;
      const status=typeof error==='object'&&error!==null&&'status' in error?error.status:undefined;
      if(status===401||status===403||status===404||status===428)discard();
    });
    const timer=window.setInterval(()=>{if(expired()){abort.abort();discard();window.clearInterval(timer);}},30_000);
    return()=>{abort.abort();window.clearInterval(timer);};
  },[api,id,captureId,coverRevision,createdAt,enabled]);
  return enabled&&value?.api===api&&value.id===id&&value.captureId===captureId?value.url:undefined;
}

export function LiveCoverSurface({url,title,containerRef}:{url?:string;title:string;containerRef?:RefObject<HTMLDivElement|null>}){
  return <div ref={containerRef} className="grid aspect-video place-items-center overflow-hidden rounded-lg bg-panel text-muted">
    {/* Private object URLs bypass the public optimizer. The fallback is public HHC branding. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url?<img src={url} alt={title} width={1280} height={720} loading="lazy" className="h-full w-full object-cover"/>:<div className="flex items-center gap-3" aria-label="HHC">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/brand/logo.png" alt="" width={56} height={56} className="size-14 object-contain"/><span className="text-2xl font-semibold tracking-widest">HHC</span>
    </div>}
  </div>;
}
export function LiveRecordingCover({api,recording}:{api:CoverApi;recording:MemberLiveRecording}){
  const {container,nearViewport}=useCoverVisibility();
  const url=useLiveRecordingCover(api,recording,nearViewport);
  return <LiveCoverSurface containerRef={container} url={url} title={recording.title}/>;
}

// Keep private bytes local to this mounted viewer; never use the public image
// optimizer, persistent storage, or playback grants for a cover.
export function useRecordingCover(api:CoverApi,id:string|undefined,expiresAt?:string|null,revision?:string,enabled=true) {
  const [value,setValue]=useState<{api:CoverApi;id:string;url:string;revision?:string}|null>(null);
  useEffect(()=>{
    if(!id||!enabled) return;
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
  },[api,id,expiresAt,revision,enabled]);
  return value?.api===api&&value.id===id&&value.revision===revision ? value.url:undefined;
}

function useCoverVisibility() {
  const container=useRef<HTMLDivElement>(null);
  const [nearViewport,setNearViewport]=useState(()=>typeof IntersectionObserver==='undefined');
  useEffect(()=>{
    if(nearViewport||!container.current)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setNearViewport(true);observer.disconnect();}
    },{rootMargin:'200px'});
    observer.observe(container.current);
    return()=>observer.disconnect();
  },[nearViewport]);
  return {container,nearViewport};
}

export function RecordingCover({api,id,title,expiresAt,revision}:{api:CoverApi;id:string;title:string;expiresAt?:string|null;revision?:string}) {
  const {container,nearViewport}=useCoverVisibility();
  const url=useRecordingCover(api,id,expiresAt,revision,nearViewport);
  return <div ref={container} className="grid aspect-video place-items-center overflow-hidden rounded-lg bg-neutral-950 text-white">
    {/* Authenticated object URLs must not pass through Next's public optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url ? <img src={url} alt={title} width={1280} height={720} loading="lazy" className="h-full w-full object-cover"/>:<Play size={28} aria-hidden="true"/>}
  </div>;
}
