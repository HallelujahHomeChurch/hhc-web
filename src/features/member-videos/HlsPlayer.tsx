'use client';

import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type Hls from 'hls.js';
import {PlayerChrome} from './PlayerChrome';
import styles from './PlayerChrome.module.css';

type Quality = 'auto' | '480p' | '720p' | '1080p';
export type PlayerLabels = {
  quality:string; auto:string; play:string; pause:string; mute:string; unmute:string;
  seek:string; volume:string; fullscreen:string; exitFullscreen:string; fullscreenError:string; playbackSpeed:string;
  settings:string; togglePlayback:string; privateCopy:string; buffering:string;
};
type Props = {
  poster?:string;
  playbackUrl:string; availableQualities:Exclude<Quality,'auto'>[]; watermark:string; title:string;
  labels:PlayerLabels; videoRef:RefObject<HTMLVideoElement|null>; onPlayingChange?:(playing:boolean)=>void; onError:()=>void;
};
function verifyMediaRequest(master:string,target:string) {
  const base=new URL(master), url=new URL(target,base);
  const prefix=base.pathname.replace(/master\.m3u8$/,'');
  const path=url.pathname.slice(prefix.length);
  if(url.origin!==base.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)
    || !/^(master\.m3u8|(480p|720p|1080p)\/(index\.m3u8|init\.mp4|seg-\d{6}\.m4s))$/.test(path)) throw new Error('Invalid media request');
}

export function HlsPlayer({playbackUrl,availableQualities,watermark,title,labels,videoRef,onPlayingChange,onError,poster}:Props) {
  const container=useRef<HTMLDivElement>(null), engine=useRef<Hls|null>(null);
  const nativeSwitch=useRef<AbortController|null>(null);
  const nativePosition=useRef<{time:number;playing:boolean;rate:number}|null>(null);
  const [mode,setMode]=useState<'loading'|'mse'|'native'|'error'>('loading');
  const [quality,setQuality]=useState<Quality>('auto');
  const qualities=(['480p','720p','1080p'] as const).filter(name=>availableQualities.includes(name));
  const handleError=useCallback(()=>{setMode('error');onError();},[onError]);

  useEffect(()=>{
    const video=videoRef.current;
    if(!video)return;
    let cancelled=false;
    const autoplay=()=>{void video.play().catch(()=>{});};
    void import('hls.js').then(({default:Hls})=>{
      if(cancelled)return;
      if(Hls.isSupported()) {
        const hls=new Hls({
          enableWorker:true, debug:false, maxBufferLength:60, maxMaxBufferLength:120,
          xhrSetup:(xhr,url)=>{verifyMediaRequest(playbackUrl,url);xhr.withCredentials=true;},
          fetchSetup:(context,init)=>{verifyMediaRequest(playbackUrl,context.url);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
        });
        engine.current=hls;
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){setMode('mse');autoplay();}});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&!cancelled)handleError();});
        hls.loadSource(playbackUrl);hls.attachMedia(video);
      } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
        setMode('native');video.src=playbackUrl;video.addEventListener('loadedmetadata',autoplay,{once:true});video.load();
      } else handleError();
    }).catch(()=>{if(!cancelled)handleError();});
    return ()=>{
      cancelled=true;nativeSwitch.current?.abort();video.removeEventListener('loadedmetadata',autoplay);
      engine.current?.destroy();engine.current=null;video.pause();video.removeAttribute('src');video.load();
    };
  },[playbackUrl,videoRef,handleError]);

  const changeQuality=(next:Quality)=>{
    const video=videoRef.current;
    if(!video || (next!=='auto'&&!qualities.includes(next)))return;
    if(engine.current) {
      const target=new URL(`${next}/index.m3u8`,playbackUrl).href;
      const index=next==='auto'?-1:engine.current.levels.findIndex(level=>level.url.includes(target));
      if(next!=='auto'&&index<0){handleError();return;}
      engine.current.nextLevel=index;
    } else if(mode==='native') {
      nativeSwitch.current?.abort();
      const controller=new AbortController();nativeSwitch.current=controller;
      const previous=nativePosition.current ?? {time:video.currentTime,playing:!video.paused,rate:video.playbackRate};
      nativePosition.current=previous;
      video.addEventListener('loadedmetadata',()=>{
        video.currentTime=Number.isFinite(video.duration)?Math.min(previous.time,video.duration):previous.time;
        video.playbackRate=previous.rate;nativePosition.current=null;
        if(previous.playing)void video.play().catch(()=>{});
      },{once:true,signal:controller.signal});
      video.src=next==='auto'?playbackUrl:new URL(`${next}/index.m3u8`,playbackUrl).href;video.load();
    } else return;
    setQuality(next);
  };
  return <div ref={container} tabIndex={0} role="region" aria-label={`${title} — ${labels.togglePlayback}`} className={styles.player}>
    <video ref={videoRef} poster={poster} playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback crossOrigin="use-credentials" aria-label={title} className="h-full w-full object-contain"
      onError={handleError}/>
    <PlayerChrome container={container} videoRef={videoRef} playbackUrl={playbackUrl} watermark={watermark} labels={labels} quality={quality} qualities={qualities} loading={mode==='loading'} failed={mode==='error'} onQualityChange={changeQuality} onPlayingChange={onPlayingChange}/>
  </div>;
}
