'use client';

import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
import {Play} from 'lucide-react';
import {usePrivateCover} from '@/lib/use-private-cover';
import type {createMemberVideoApi} from './api';

type CoverApi=ReturnType<typeof createMemberVideoApi>;

export function useLiveRecordingCover(api:CoverApi,recording:MemberLiveRecording,enabled=true){
  const {id,captureId,coverRevision,createdAt}=recording;
  const load=useCallback((signal:AbortSignal)=>api.liveCover(id,captureId,signal),[api,id,captureId]);
  return usePrivateCover({scope:api,resource:`live:${id}:${captureId}`,revision:coverRevision??'',expiresAt:Date.parse(createdAt)+24*60*60*1000,enabled:enabled&&Boolean(coverRevision),keepPrevious:true,load});
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

// Covers are account-bound; the provider restores persisted JPEGs only after access checks.
export function useRecordingCover(api:CoverApi,id:string|undefined,expiresAt?:string|null,revision?:string,enabled=true) {
  const load=useCallback((signal:AbortSignal)=>api.cover(id!,signal),[api,id]);
  return usePrivateCover({scope:api,resource:`vod:${id}`,revision,expiresAt:expiresAt?Date.parse(expiresAt):undefined,enabled:enabled&&Boolean(id),load});
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
