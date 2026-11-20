'use client';

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {HhcWebApiError, type MemberLivePlayback} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import type {PlayerBookmark} from './live-player';

type LiveApi=Pick<ReturnType<typeof createMemberVideoApi>,'liveGrant'|'exchangeLive'|'clearLive'>;
type Playback={grant:MemberLivePlayback;url:string;requestNumber:number};

export function useLivePlayback(api:LiveApi,recordingId:string,captureId:string,awaitingMedia=false,onStop?:()=>void){
 const currentApi = useRef(api);
 useLayoutEffect(() => { currentApi.current = api; }, [api]);
 const [playback,setPlayback]=useState<Playback|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(false),[closed,setClosed]=useState(false),[expired,setExpired]=useState(false);
 const [exhausted,setExhausted]=useState(false);
 const bookmark=useRef<PlayerBookmark|undefined>(undefined),scope=useRef<string|null>(null);
 const stopPlayback=useRef(onStop);
 useEffect(()=>{stopPlayback.current=onStop;},[onStop]);
 const readiness=useRef(awaitingMedia);
 useEffect(()=>{readiness.current=awaitingMedia;},[awaitingMedia]);
 const cookieOperations=useRef(Promise.resolve()),activePlayback=useRef<Playback|null>(null);
 const runner=useRef<()=>Promise<boolean|undefined>>(async()=>false);
 const requests=useRef(0),freshRunner=useRef<()=>Promise<boolean|undefined>>(async()=>false);
 const revalidate=useCallback(async()=>{const required=requests.current+1;await freshRunner.current();return required;},[]);
 const remember=useCallback((value:PlayerBookmark)=>{bookmark.current=value;},[]);
 const start=useCallback(()=>runner.current(),[]);
 useEffect(()=>{
  const controller=new AbortController();let active:Playback|null=null,terminal=false,expiry=0,hardEnd=Infinity,renewAt=0,failures=0;
  let renewTimer=0,expiryTimer=0;
  const clearCookie=(url:string)=>{
   cookieOperations.current=cookieOperations.current.then(()=>{
    // An expiry during exchange must not delete the renewed same-scope cookie.
    if(activePlayback.current?.url!==url)return currentApi.current.clearLive(url);
   }).catch(()=>{});
  };
  const clear=()=>{
   if(!active)return;
   stopPlayback.current?.();
   const url=active.url;if(activePlayback.current===active)activePlayback.current=null;active=null;setPlayback(null);
   clearCookie(url);
  };
  const stop=(isExpired=false)=>{setExpired(isExpired);terminal=true;clear();window.clearTimeout(renewTimer);window.clearTimeout(expiryTimer);setClosed(true);setError(true);};
  const expire=()=>{clear();window.clearTimeout(renewTimer);setError(true);};
  const run=async():Promise<boolean|undefined>=>{
   if(terminal||controller.signal.aborted)return;
   if(Date.now()>=hardEnd){stop(true);return;}
   if(expiry&&Date.now()>=expiry)expire();
   setPending(true);setExhausted(false);window.clearTimeout(renewTimer);
   const requestedAt=Date.now(),requestNumber=++requests.current;
   const request=new AbortController();
   const abortRequest=()=>request.abort();
   controller.signal.addEventListener('abort',abortRequest,{once:true});
   // A scheduled renewal may still complete across the old grant's expiry.
   // Cold entry and explicit rechecks should offer recovery sooner.
   const scheduledRenewal=active&&requestedAt>=renewAt;
   const deadline=window.setTimeout(abortRequest,scheduledRenewal?75000:15000);
   scope.current??=crypto.randomUUID();
   try{
    const grant=await currentApi.current.liveGrant(recordingId,captureId,scope.current,request.signal);
    if(controller.signal.aborted)return;
    request.signal.throwIfAborted();
    const server=Date.parse(grant.serverNow),issued=Date.parse(grant.issuedAt),ends=Date.parse(grant.expiresAt);
    const ttl=ends-issued,remaining=ends-server;
    const limit=Math.min(Date.parse(grant.captureExpiresAt),grant.replayUntil?Date.parse(grant.replayUntil):Infinity);
    if(grant.recordingId!==recordingId||grant.captureId!==captureId||grant.playbackScopeId!==scope.current||!Number.isFinite(ttl)||ttl<=0||ttl>300000||!Number.isFinite(remaining)||remaining<=0||remaining>300000||!Number.isFinite(limit)||ends>limit||['failed','expired','aborted'].includes(grant.liveState)){
     stop(grant.liveState==='expired');return;
    }
    // Anchor server deltas before the request: network time never extends authorization.
    const nextExpiry=requestedAt+remaining,nextHardEnd=requestedAt+limit-server;
    if(Date.now()>=nextExpiry){throw new Error('Live grant expired before exchange');}
    const exchange=cookieOperations.current.then(async()=>{
     if(controller.signal.aborted)return;
     request.signal.throwIfAborted();
     const url=await currentApi.current.exchangeLive(grant,request.signal);
     if(request.signal.aborted){clearCookie(url);request.signal.throwIfAborted();}
     if((active&&url!==active.url)||Date.now()>=nextExpiry){stop();clearCookie(url);return;}
     active={grant,url,requestNumber};activePlayback.current=active;expiry=nextExpiry;hardEnd=nextHardEnd;renewAt=expiry-Math.min(60000,ttl*.2);failures=0;
     setPlayback(active);setError(false);
     window.clearTimeout(expiryTimer);
     expiryTimer=window.setTimeout(()=>Date.now()>=hardEnd?stop(true):expire(),Math.max(0,expiry-Date.now()));
     if(expiry<hardEnd)renewTimer=window.setTimeout(()=>void sharedRun(),Math.max(1000,renewAt-Date.now()));
     return true;
    });
    cookieOperations.current=exchange.then(()=>{},()=>{});
    return await exchange;
   }catch(cause){
    if(controller.signal.aborted)return;
    setError(!(readiness.current&&cause instanceof HhcWebApiError&&cause.status===409&&cause.code==='capture_conflict'));
    if(cause instanceof HhcWebApiError&&[401,403,404,410].includes(cause.status)){stop();return;}
    const delay=Math.min(30000,5000*2**Math.min(failures++,3));
    if(failures<=5&&(!expiry||Date.now()+delay<expiry))renewTimer=window.setTimeout(()=>void sharedRun(),delay);
    else setExhausted(true);
   }finally{
    window.clearTimeout(deadline);controller.signal.removeEventListener('abort',abortRequest);
    if(!controller.signal.aborted)setPending(false);
   }
  };
  // Unlock, network recovery and scheduled renewal may request the same grant.
  let outstanding:ReturnType<typeof run>|undefined;
  const sharedRun=()=>{
   if(!outstanding)outstanding=run().finally(()=>{outstanding=undefined;});
   return outstanding;
  };
  runner.current=sharedRun;
  // A watch revision requires a request issued after that revision was observed.
  freshRunner.current=()=>outstanding?outstanding.then(sharedRun):sharedRun();
  const wake=()=>{
   if(!scope.current||document.visibilityState==='hidden')return;
   if(expiry&&Date.now()>=expiry)expire();
   if(!active||Date.now()>=renewAt)void sharedRun();
  };
  document.addEventListener('visibilitychange',wake);window.addEventListener('pageshow',wake);window.addEventListener('online',wake);
  return()=>{
   controller.abort();window.clearTimeout(renewTimer);window.clearTimeout(expiryTimer);
   document.removeEventListener('visibilitychange',wake);window.removeEventListener('pageshow',wake);window.removeEventListener('online',wake);
   if(active){stopPlayback.current?.();const url=active.url;if(activePlayback.current===active)activePlayback.current=null;active=null;clearCookie(url);}
  };
 },[recordingId,captureId]);
 return {playback,pending,error,closed,expired,exhausted,bookmark,remember,start,revalidate};
}
