'use client';

import {useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode} from 'react';
import type {MemberLiveRecording, MemberRecording, MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import {HlsPlayer, type PlayerLabels} from './HlsPlayer';
import {useLivePlayback} from './useLivePlayback';
import styles from './MemberVideoZone.module.css';

type Api=ReturnType<typeof createMemberVideoApi>;
type PreviewProps={api:Api;recording:MemberRecording|MemberLiveRecording;labels:PlayerLabels;onError:()=>void};

// Mounting owns one private playback scope. Hovering never sends playback metrics.
function VodPreview({api,recording,labels,onError}:PreviewProps){
 const [playback,setPlayback]=useState<{grant:MemberRecordingPlayback;url:string}|null>(null);
 const [visible,setVisible]=useState(false),video=useRef<HTMLVideoElement>(null);
 const packageId='packageId' in recording?recording.packageId:undefined;
 useEffect(()=>{
  if(!packageId)return;
  const controller=new AbortController(),scope=crypto.randomUUID();let url:string|undefined,renewTimer=0,expiryTimer=0;
  const clear=(value:string)=>void api.clear(value).catch(()=>{});
  const load=async()=>{
   try{
    const grant=await api.grant(recording.id,scope,packageId,controller.signal);
    if(controller.signal.aborted)return;
    const expiry=Date.parse(grant.expiresAt);
    if(grant.packageId!==packageId||new URL(grant.mediaUrl).pathname!==`/videos/${recording.id}/packages/${packageId}/sessions/${scope}/master.m3u8`||!Number.isFinite(expiry)||expiry<=Date.now())throw new Error('Invalid preview grant');
    const next=await api.exchange(grant,controller.signal);
    if(controller.signal.aborted){clear(next);return;}
    if(url&&next!==url){clear(next);throw new Error('Preview scope changed');}
    url=next;setPlayback({grant,url});window.clearTimeout(expiryTimer);
    expiryTimer=window.setTimeout(()=>{controller.abort();onError();},Math.max(0,expiry-Date.now()));
    renewTimer=window.setTimeout(()=>void load(),Math.max(1000,(expiry-Date.now())*.8));
   }catch{if(!controller.signal.aborted)onError();}
  };
  void load();return()=>{controller.abort();window.clearTimeout(renewTimer);window.clearTimeout(expiryTimer);if(url)clear(url);};
 },[api,recording.id,packageId,onError]);
 return playback?<span className={styles.preview} data-playing={visible}><HlsPlayer playbackUrl={playback.url} videoRef={video} title={recording.title} labels={labels} watermark={playback.grant.watermarkCode} availableQualities={(playback.grant.renditions??[]).map(item=>item.name)} initialQuality="480p" controls={false} muted onPlayingChange={setVisible} onError={onError}/></span>:null;
}

function LivePreview({api,recording,labels,onError}:PreviewProps&{recording:MemberLiveRecording}){
 const session=useLivePlayback(api,recording.id,recording.captureId),video=useRef<HTMLVideoElement>(null);
 const [origin,setOrigin]=useState<number|null>(null),[visible,setVisible]=useState(false);
 const {start}=session;
 useEffect(()=>{
  const controller=new AbortController();
  void api.watch(recording.id,controller.signal).then(watch=>{
   if(controller.signal.aborted)return;
   if(watch.live?.id!==recording.id||watch.live.captureId!==recording.captureId||watch.view!=='live'||watch.mediaStartSeconds==null){onError();return;}
   setOrigin(watch.mediaStartSeconds);void start();
  }).catch(()=>{if(!controller.signal.aborted)onError();});
  return()=>controller.abort();
 },[api,recording.id,recording.captureId,start,onError]);
 useEffect(()=>{if(session.error||session.closed)onError();},[session.error,session.closed,onError]);
 const playback=session.playback;
 return playback&&origin!==null?<span className={styles.preview} data-playing={visible}><HlsPlayer playbackMode="live" playbackUrl={playback.url} videoRef={video} title={recording.title} labels={labels} watermark={playback.grant.watermarkCode} availableQualities={['480p','720p','1080p']} initialQuality="480p" controls={false} muted onPlayingChange={setVisible} onError={onError} live={{verifiedEnd:Math.max(recording.progress.mediaEndSeconds,playback.grant.progress.mediaEndSeconds)-origin,ended:['ending','ended'].includes(playback.grant.liveState),canFollow:true,label:'',backToLive:'',liveLabel:''}}/></span>:null;
}

export function ThumbnailPreview({api,recording,labels,enabled,activeId,onActive,children}:Omit<PreviewProps,'onError'>&{enabled:boolean;activeId:string|null;onActive:Dispatch<SetStateAction<string|null>>;children:ReactNode}){
 const element=useRef<HTMLSpanElement>(null),timer=useRef(0),[failed,setFailed]=useState(false);
 const active=enabled&&activeId===recording.id;
 const stop=useCallback(()=>{window.clearTimeout(timer.current);onActive(current=>current===recording.id?null:current);},[onActive,recording.id]);
 const fail=useCallback(()=>setFailed(true),[]);
 useEffect(()=>{
  const visibility=()=>{if(document.visibilityState==='hidden')stop();};
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{if(entries.some(entry=>!entry.isIntersecting))stop();});
  if(element.current)observer?.observe(element.current);
  document.addEventListener('visibilitychange',visibility);
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',visibility);window.clearTimeout(timer.current);};
 },[stop]);
 return <span ref={element} className={styles.previewSurface} onPointerEnter={event=>{
  if(!enabled||event.pointerType==='touch'||!window.matchMedia('(hover: hover) and (pointer: fine)').matches||document.visibilityState==='hidden')return;
  setFailed(false);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>onActive(recording.id),500);
 }} onPointerLeave={stop}>
  {children}
  {active&&!failed?('captureId' in recording?<LivePreview api={api} recording={recording} labels={labels} onError={fail}/>:<VodPreview api={api} recording={recording} labels={labels} onError={fail}/>):null}
 </span>;
}
