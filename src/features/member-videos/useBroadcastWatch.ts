'use client';

import {useEffect,useState} from 'react';
import type {RecordingWatchView,MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import {broadcastPollDelay} from './broadcast';

export function useBroadcastWatch(api:ReturnType<typeof createMemberVideoApi>,id:string|undefined,retry:number) {
 const [watch,setWatch]=useState<RecordingWatchView|null>(null);
 const [lastLive,setLastLive]=useState<MemberLiveRecording|null>(null);
 const [error,setError]=useState(false);
 const [denied,setDenied]=useState(false);
 useEffect(()=>{
  if(!id)return;
  const controller=new AbortController();let timer=0,inFlight=false,failures=0,view='waiting';
  const load=async()=>{
   if(inFlight||controller.signal.aborted)return;
   window.clearTimeout(timer);inFlight=true;
   try{const result=await api.watch(id,controller.signal);if(!controller.signal.aborted){setWatch(result);if(result.live)setLastLive(result.live);view=result.view;failures=0;setError(false);setDenied(false);}}
   catch(error){if(!controller.signal.aborted){failures++;setError(true);if(error instanceof HhcWebApiError&&[401,403,404,410].includes(error.status)){setWatch(null);setLastLive(null);setDenied(true);}}}
   finally{inFlight=false;if(!controller.signal.aborted){const base=broadcastPollDelay(view,document.hidden,failures);timer=window.setTimeout(()=>void load(),failures?Math.min(60000,base*(.9+Math.random()*.2)):base);}}
  };
  const foreground=()=>{if(!document.hidden)void load();};
  void load();document.addEventListener('visibilitychange',foreground);window.addEventListener('online',foreground);
  return()=>{controller.abort();window.clearTimeout(timer);document.removeEventListener('visibilitychange',foreground);window.removeEventListener('online',foreground);};
 },[api,id,retry]);
 return {watch,lastLive,error,denied};
}
