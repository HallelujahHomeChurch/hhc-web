'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';
import {Maximize, Minimize, Pause, Play, Volume2, VolumeX} from 'lucide-react';
import type Hls from 'hls.js';

type Quality = 'auto' | '720p' | '1080p';
export type PlayerLabels = {
  quality:string; auto:string; play:string; pause:string; mute:string; unmute:string;
  seek:string; volume:string; fullscreen:string; exitFullscreen:string; playbackSpeed:string;
};
type Props = {
  playbackUrl:string; availableQualities:Exclude<Quality,'auto'>[]; watermark:string; title:string;
  labels:PlayerLabels; videoRef:RefObject<HTMLVideoElement|null>; onPlayingChange:(playing:boolean)=>void; onError:()=>void;
};
function clock(seconds:number) {
  const total=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
  return total>=3600 ? `${Math.floor(total/3600)}:${String(Math.floor(total/60)%60).padStart(2,'0')}:${String(total%60).padStart(2,'0')}` : `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}
function verifyMediaRequest(master:string,target:string) {
  const base=new URL(master), url=new URL(target,base);
  const prefix=base.pathname.replace(/master\.m3u8$/,'');
  const path=url.pathname.slice(prefix.length);
  if(url.origin!==base.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)
    || !/^(master\.m3u8|(720p|1080p)\/(index\.m3u8|init\.mp4|seg-\d{6}\.m4s))$/.test(path)) throw new Error('Invalid media request');
}

export function HlsPlayer({playbackUrl,availableQualities,watermark,title,labels,videoRef,onPlayingChange,onError}:Props) {
  const container=useRef<HTMLDivElement>(null), engine=useRef<Hls|null>(null);
  const nativeSwitch=useRef<AbortController|null>(null);
  const nativePosition=useRef<{time:number;playing:boolean;rate:number}|null>(null);
  const [mode,setMode]=useState<'loading'|'mse'|'native'>('loading');
  const [quality,setQuality]=useState<Quality>('auto');
  const [playing,setPlaying]=useState(false), [muted,setMuted]=useState(false), [volume,setVolume]=useState(1);
  const [time,setTime]=useState(0), [duration,setDuration]=useState(0), [fullscreen,setFullscreen]=useState(false);
  const qualities=(['720p','1080p'] as const).filter(name=>availableQualities.includes(name));

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
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&!cancelled)onError();});
        hls.loadSource(playbackUrl);hls.attachMedia(video);
      } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
        setMode('native');video.src=playbackUrl;video.addEventListener('loadedmetadata',autoplay,{once:true});video.load();
      } else onError();
    }).catch(()=>{if(!cancelled)onError();});
    return ()=>{
      cancelled=true;nativeSwitch.current?.abort();video.removeEventListener('loadedmetadata',autoplay);
      engine.current?.destroy();engine.current=null;video.pause();video.removeAttribute('src');video.load();
    };
  },[playbackUrl,videoRef,onError]);
  useEffect(()=>{
    const changed=()=>setFullscreen(document.fullscreenElement===container.current);
    document.addEventListener('fullscreenchange',changed);
    return ()=>document.removeEventListener('fullscreenchange',changed);
  },[]);

  const changeQuality=(next:Quality)=>{
    const video=videoRef.current;
    if(!video || (next!=='auto'&&!qualities.includes(next)))return;
    if(engine.current) {
      const target=new URL(`${next}/index.m3u8`,playbackUrl).href;
      const index=next==='auto'?-1:engine.current.levels.findIndex(level=>level.url.includes(target));
      if(next!=='auto'&&index<0){onError();return;}
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
  const toggle=()=>{const video=videoRef.current;if(video){if(video.paused)void video.play().catch(()=>{});else video.pause();}};
  const updatePlaying=(value:boolean)=>{setPlaying(value);onPlayingChange(value);};
  const toggleFullscreen=async()=>{
    try {if(document.fullscreenElement===container.current)await document.exitFullscreen();else await container.current?.requestFullscreen();}
    catch { /* Remain inline: never move only the video outside its watermark. */ }
  };
  const button='inline-flex min-h-11 min-w-11 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-white';
  return <div ref={container} className="relative aspect-video overflow-hidden rounded-[14px] bg-neutral-950 text-white [&:fullscreen]:aspect-auto [&:fullscreen]:h-dvh [&:fullscreen]:w-screen [&:fullscreen]:rounded-none">
    <video ref={videoRef} playsInline preload="metadata" controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture disableRemotePlayback crossOrigin="use-credentials" aria-label={title} className="h-full w-full object-contain"
      onPlay={()=>updatePlaying(true)} onPause={()=>updatePlaying(false)} onEnded={()=>updatePlaying(false)} onError={onError}
      onTimeUpdate={()=>setTime(videoRef.current?.currentTime??0)} onDurationChange={()=>setDuration(videoRef.current?.duration??0)}
      onVolumeChange={()=>{setMuted(videoRef.current?.muted??false);setVolume(videoRef.current?.volume??1);}} />
    <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 rounded bg-black/40 px-2 py-1 text-xs text-white/75">{watermark}</span>
    <div className="absolute inset-x-0 bottom-0 grid gap-1 bg-black/80 px-3 pb-1">
      <input type="range" aria-label={labels.seek} aria-valuetext={`${clock(time)} / ${clock(duration)}`} min={0} max={Number.isFinite(duration)&&duration>0?duration:0} step={0.1} value={time} disabled={!Number.isFinite(duration)||duration<=0} onChange={event=>{if(videoRef.current)videoRef.current.currentTime=Number(event.target.value);setTime(Number(event.target.value));}} className="w-full accent-white"/>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <button type="button" className={button} aria-label={playing?labels.pause:labels.play} onClick={toggle}>{playing?<Pause size={19}/>:<Play size={19}/>}</button>
        <span className="text-xs tabular-nums">{clock(time)} / {clock(duration)}</span>
        <button type="button" className={button} aria-label={muted?labels.unmute:labels.mute} onClick={()=>{if(videoRef.current)videoRef.current.muted=!videoRef.current.muted;}}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>
        <input type="range" aria-label={labels.volume} min={0} max={1} step={0.05} value={muted?0:volume} onChange={event=>{if(videoRef.current){videoRef.current.volume=Number(event.target.value);videoRef.current.muted=false;}}} className="hidden w-20 accent-white sm:block"/>
        <select aria-label={labels.playbackSpeed} defaultValue="1" onChange={event=>{if(videoRef.current)videoRef.current.playbackRate=Number(event.target.value);}} className="min-h-11 rounded bg-neutral-950 px-2 text-sm focus-visible:outline-2 focus-visible:outline-white">{[0.75,1,1.25,1.5,2].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select>
        <select aria-label={labels.quality} value={quality} disabled={mode==='loading'} onChange={event=>changeQuality(event.target.value as Quality)} className="ml-auto min-h-11 rounded bg-neutral-950 px-2 text-sm focus-visible:outline-2 focus-visible:outline-white"><option value="auto">{labels.auto}</option>{qualities.map(name=><option key={name} value={name}>{name}</option>)}</select>
        {typeof document!=='undefined' && typeof document.documentElement.requestFullscreen==='function' ? <button type="button" className={button} aria-label={fullscreen?labels.exitFullscreen:labels.fullscreen} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={19}/>:<Maximize size={19}/>}</button>:null}
      </div>
    </div>
  </div>;
}
