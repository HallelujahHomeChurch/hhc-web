'use client';

/* oxlint-disable react/only-export-components */

import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {coverCacheChangeKey,privateCoverCache,type PrivateCoverCache} from './private-cover-cache';

type Binding={cache:PrivateCoverCache;accountId:string|null|undefined;ready:boolean};
const CoverContext=createContext<Binding|null>(null);
const idleSubscribe=()=>()=>{};
const idleSnapshot=()=>0;
export function PrivateCoverProvider({accountId,children,cache=privateCoverCache}:{accountId:string|null|undefined;children:ReactNode;cache?:PrivateCoverCache}){
 const [prepared,setPrepared]=useState<{cache:PrivateCoverCache;accountId:string|null}|null>(()=>accountId&&cache.active(accountId)?{cache,accountId}:null);
 useEffect(()=>{
  let disposed=false;
  if(accountId===undefined){cache.lock();return;}
  void cache.setAccount(accountId).then(()=>{if(!disposed)setPrepared({cache,accountId});});
  return()=>{disposed=true;};
 },[accountId,cache]);
 useEffect(()=>{
  const changed=(event:StorageEvent)=>{if(event.key===coverCacheChangeKey)void cache.checkSession();};
  window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[cache]);
 return <CoverContext.Provider value={{cache,accountId,ready:prepared?.cache===cache&&prepared.accountId===accountId}}>{children}</CoverContext.Provider>;
}

type Image={url:string;scope:unknown;resource:string;revision:string;accountId?:string|null;cache?:PrivateCoverCache};
type Options={scope:unknown;resource:string;revision?:string;expiresAt?:number;enabled?:boolean;keepPrevious?:boolean;retry?:boolean;load:(signal:AbortSignal)=>Promise<Blob>};
export function usePrivateCover({scope,resource,revision='',expiresAt=Infinity,enabled=true,keepPrevious=false,retry=false,load}:Options){
 const binding=useContext(CoverContext),cache=binding?.cache,accountId=binding?.accountId;
 useSyncExternalStore(cache?.subscribe??idleSubscribe,cache?.snapshot??idleSnapshot,idleSnapshot);
 const [image,setImage]=useState<Image|null>(null),current=useRef<Image|null>(null);
 const allowed=!binding||Boolean(accountId&&binding.ready&&cache?.active(accountId));
 const cacheable=Boolean(cache&&accountId&&revision);
 const discard=()=>{if(current.current){if(current.current.cache)current.current.cache.release(current.current.url);else URL.revokeObjectURL(current.current.url);}current.current=null;};
 useEffect(()=>()=>{discard();},[scope,resource,accountId]);
 useEffect(()=>{
  if(!enabled||!allowed||Number.isNaN(expiresAt)||expiresAt<=Date.now()){discard();return;}
  const controller=new AbortController();let timer=0,attempts=0;
  if(!keepPrevious&&current.current?.revision!==revision){discard();}
  const run=async()=>{
   attempts++;
   try{
    let url:string;
    if(cacheable)url=await cache!.load(accountId!,resource,revision,expiresAt,load);
    else{
     const blob=await load(controller.signal);
     if(controller.signal.aborted||expiresAt<=Date.now())return;
     url=URL.createObjectURL(blob);
    }
    if(controller.signal.aborted||expiresAt<=Date.now()){if(!cacheable)URL.revokeObjectURL(url);return;}
    discard();if(cacheable)cache!.retain(url);const value={url,scope,resource,revision,accountId,cache:cacheable?cache:undefined};current.current=value;setImage(value);
   }catch(error){
    if(controller.signal.aborted)return;
    const status=typeof error==='object'&&error!==null&&'status' in error?Number(error.status):0;
    if([401,403,404,428].includes(status)){
     if(cache&&accountId)void cache.forget(accountId,resource);
     discard();setImage(null);
    }
    if(retry&&attempts<12&&(error instanceof TypeError||[404,408,409,429].includes(status)||status>=500))timer=window.setTimeout(()=>void run(),5000);
   }
  };
  void run();
  const expiryTimer=window.setInterval(()=>{
   if(expiresAt<=Date.now()){
    controller.abort();window.clearTimeout(timer);window.clearInterval(expiryTimer);
    if(cache&&accountId)void cache.forget(accountId,resource);
    discard();setImage(null);
   }
  },30_000);
  return()=>{controller.abort();window.clearTimeout(timer);window.clearInterval(expiryTimer);};
 },[scope,resource,revision,expiresAt,enabled,allowed,keepPrevious,retry,cache,accountId,cacheable,load]);
 // eslint-disable-next-line react-hooks/purity -- Recheck private-image expiry before displaying cached bytes.
 if(!allowed||Number.isNaN(expiresAt)||expiresAt<=Date.now())return;
 const cached=cacheable?cache!.peek(accountId!,resource,revision,expiresAt):undefined;
 if(cached)return cached;
 if(!enabled)return;
 if(cacheable)return image&&cache!.retained(image.url)&&image.scope===scope&&image.resource===resource&&image.accountId===accountId&&(keepPrevious||image.revision===revision)?image.url:undefined;
 return image&&image.scope===scope&&image.resource===resource&&image.accountId===accountId&&(keepPrevious||image.revision===revision)?image.url:undefined;
}
