'use client';

import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type Hls from 'hls.js';
import {liveWindow, type LivePlayerState, type PlayerBookmark, type PlaybackIntent} from './live-player';
import {PlayerChrome} from './PlayerChrome';
import styles from './PlayerChrome.module.css';

type Quality = 'auto' | '480p' | '720p' | '1080p';
export type PlayerLabels = {
  quality:string; auto:string; play:string; pause:string; mute:string; unmute:string;
  seek:string; volume:string; fullscreen:string; exitFullscreen:string; fullscreenError:string; playbackSpeed:string;
  previousVideo?:string; nextVideo?:string; theaterMode?:string; exitTheaterMode?:string; tapToPlay?:string;
  settingsBack?:string; replay?:string; settings:string; togglePlayback:string; privateCopy:string; buffering:string;
};
type Props = {
  playbackMode?: 'vod' | 'live'; live?: LivePlayerState; resume?: PlayerBookmark; onBookmark?: (value: PlayerBookmark) => void;
  poster?:string; previousHref?:string; nextHref?:string;
  playbackUrl:string; availableQualities:Exclude<Quality,'auto'>[]; watermark:string; title:string;
  labels:PlayerLabels; videoRef:RefObject<HTMLVideoElement|null>; onPlayingChange?:(playing:boolean)=>void; onError:(bookmark?:PlayerBookmark)=>void;
};
function verifyMediaRequest(master:string,target:string) {
  const base=new URL(master), url=new URL(target,base);
  const prefix=base.pathname.replace(/master\.m3u8$/,'');
  const path=url.pathname.slice(prefix.length);
  if(url.origin!==base.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)
    || !/^(master\.m3u8|(480p|720p|1080p)\/(index\.m3u8|init\.mp4|seg-\d{6}\.m4s))$/.test(path)) throw new Error('Invalid media request');
}

export function HlsPlayer({playbackUrl,availableQualities,watermark,title,labels,videoRef,onPlayingChange,onError,poster,previousHref,nextHref,playbackMode='vod',live,resume,onBookmark}:Props) {
  const container=useRef<HTMLDivElement>(null), engine=useRef<Hls|null>(null);
  const qualitySwitch=useRef<AbortController|null>(null);
  const qualityPosition=useRef<Pick<PlayerBookmark,'time'|'paused'|'rate'>|null>(null);
  const [autoplayBlocked,setAutoplayBlocked]=useState(false);
  const [mode,setMode]=useState<'loading'|'mse'|'native'|'error'>('loading');
  const [activeHeight,setActiveHeight]=useState<number|null>(null);
  const [quality,setQuality]=useState<Quality>(resume?.quality ?? 'auto');
  const intent=useRef<PlaybackIntent>(resume?.intent ?? 'followLive'), positioned=useRef(false), closing=useRef(false);
  const failed=useRef(false), pausedIntent=useRef(resume?.paused??true);
  const automaticSeek=useRef<number|null>(null), recovery=useRef(false);
  const currentLive=useRef(live), bookmarkCallback=useRef(onBookmark), qualityRef=useRef(quality), initialBookmark=useRef(resume);
  useEffect(()=>{currentLive.current=live;bookmarkCallback.current=onBookmark;qualityRef.current=quality;},[live,onBookmark,quality]);
  const remember=useCallback(()=>{
    const video=videoRef.current;
    if(video&&!closing.current&&!failed.current&&!qualityPosition.current)bookmarkCallback.current?.({time:video.currentTime,paused:video.paused,rate:video.playbackRate,quality:qualityRef.current,intent:intent.current});
  },[videoRef]);
  const dvr=useCallback(()=>{intent.current='dvr';remember();},[remember]);
  const returnToLive=()=>{
    const video=videoRef.current, state=currentLive.current;
    if(!video||!state?.canFollow)return;
    const window=liveWindow(video.seekable,state.verifiedEnd);if(!window)return;
    if(qualityPosition.current){qualityPosition.current.time=window.edge;qualityPosition.current.paused=false;}
    intent.current='followLive';automaticSeek.current=window.edge;video.currentTime=window.edge;positioned.current=true;
    void video.play().catch(()=>{});remember();
  };
  const qualities=(['480p','720p','1080p'] as const).filter(name=>availableQualities.includes(name));
  const handleError=useCallback(()=>{
    if(failed.current)return;
    const video=videoRef.current;
    const position=qualityPosition.current??{time:video?.currentTime??0,paused:pausedIntent.current,rate:video?.playbackRate??1};
    const bookmark=positioned.current||qualityPosition.current?{...position,quality:qualityRef.current,intent:intent.current}:initialBookmark.current;
    failed.current=true;qualitySwitch.current?.abort();setMode('error');onError(bookmark);
  },[onError,videoRef]);

  useEffect(()=>{
    const video=videoRef.current;
    if(!video)return;
    let cancelled=false;closing.current=false;failed.current=false;
    const autoplay=()=>{
      if(initialBookmark.current?.paused)return;
      void video.play().catch((error:unknown)=>{
        if(!cancelled && error instanceof DOMException && error.name==='NotAllowedError')setAutoplayBlocked(true);
      });
    };
    void import('hls.js').then(({default:Hls})=>{
      if(cancelled)return;
      setActiveHeight(null);
      if(Hls.isSupported()) {
        const hls=new Hls({
          enableWorker:true, debug:false, maxBufferLength:60, maxMaxBufferLength:120,
          ...(playbackMode==='live'?{backBufferLength:120,lowLatencyMode:false,liveSyncDuration:30,liveMaxLatencyDuration:Infinity,maxLiveSyncPlaybackRate:1}:{}),
          xhrSetup:(xhr,url)=>{verifyMediaRequest(playbackUrl,url);xhr.withCredentials=true;},
          fetchSetup:(context,init)=>{verifyMediaRequest(playbackUrl,context.url);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
        });
        engine.current=hls;
        // LEVEL_SWITCHED follows the fragment currently playing, not the next ABR choice.
        hls.on(Hls.Events.LEVEL_SWITCHED,(_event,data)=>{if(!cancelled&&!failed.current){const height=hls.levels[data.level]?.height;setActiveHeight(height>0?height:null);}});
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){
          const selected=qualityRef.current;
          if(selected!=='auto'){const target=new URL(`${selected}/index.m3u8`,playbackUrl).href;hls.nextLevel=hls.levels.findIndex(level=>level.url.includes(target));}
          setMode('mse');autoplay();
        }});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&!cancelled)handleError();});
        hls.loadSource(playbackUrl);hls.attachMedia(video);
      } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
        setMode('native');video.src=qualityRef.current==='auto'?playbackUrl:new URL(`${qualityRef.current}/index.m3u8`,playbackUrl).href;video.addEventListener('loadedmetadata',autoplay,{once:true});video.load();
      } else handleError();
    }).catch(()=>{if(!cancelled)handleError();});
    return ()=>{
      cancelled=true;closing.current=true;qualitySwitch.current?.abort();qualityPosition.current=null;video.removeEventListener('loadedmetadata',autoplay);
      engine.current?.destroy();engine.current=null;video.pause();video.removeAttribute('src');video.load();
    };
  },[playbackUrl,videoRef,handleError,playbackMode]);

  useEffect(()=>{
    const video=videoRef.current;if(!video)return;
    positioned.current=false;
    const position=()=>{
      const state=currentLive.current;
      if(qualityPosition.current||closing.current||failed.current)return;
      const window=playbackMode==='live'&&state?liveWindow(video.seekable,state.verifiedEnd):null;
      if(playbackMode==='live'&&!window)return;
      if(!positioned.current){
        const saved=initialBookmark.current;
        if(saved){
          const end=window?.end??(Number.isFinite(video.duration)?video.duration:saved.time);
          automaticSeek.current=Math.max(window?.start??0,Math.min(end,saved.time));video.currentTime=automaticSeek.current;
          video.playbackRate=saved.rate;if(saved.paused)video.pause();
        }else if(window){automaticSeek.current=window.edge;video.currentTime=window.edge;}
        positioned.current=true;remember();
      }else if(window&&recovery.current&&state?.canFollow&&intent.current==='followLive'){
        recovery.current=false;automaticSeek.current=window.edge;video.currentTime=window.edge;remember();
      }
    };
    const seeking=()=>{if(!positioned.current||closing.current||qualityPosition.current)return;if(automaticSeek.current!==null&&Math.abs(video.currentTime-automaticSeek.current)<0.1){automaticSeek.current=null;return;}dvr();};
    const resolution=()=>{if(!engine.current)setActiveHeight(video.videoHeight>0?video.videoHeight:null);};
    const paused=()=>{if(!closing.current&&!failed.current&&!video.error&&positioned.current&&!qualityPosition.current){pausedIntent.current=true;dvr();}};
    const online=()=>{recovery.current=true;position();};
    const events:[string,()=>void][]=[['loadedmetadata',position],['progress',position],['durationchange',position],['canplay',position],['seeking',seeking],['pause',paused],['timeupdate',remember],['ratechange',remember],['play',remember],['loadedmetadata',resolution],['resize',resolution]];
    for(const [event,handler] of events)video.addEventListener(event,handler);
    window.addEventListener('online',online);
    return()=>{for(const [event,handler] of events)video.removeEventListener(event,handler);window.removeEventListener('online',online);};
  },[playbackUrl,playbackMode,videoRef,remember,dvr]);

  const changeQuality=(next:Quality)=>{
    const video=videoRef.current;
    if(!video || (next!=='auto'&&!qualities.includes(next)))return;
    const preservePosition=()=>{
      qualitySwitch.current?.abort();
      const controller=new AbortController();qualitySwitch.current=controller;
      const previous=qualityPosition.current ?? {time:video.currentTime,paused:video.paused,rate:video.playbackRate};
      qualityPosition.current=previous;
      const restore=()=>{
        if(engine.current&&video.readyState<1)return;
        const window=playbackMode==='live'&&currentLive.current?liveWindow(video.seekable,currentLive.current.verifiedEnd):null;
        if(playbackMode==='live'&&!window)return;
        automaticSeek.current=window?Math.max(window.start,Math.min(previous.time,window.end)):Number.isFinite(video.duration)?Math.min(previous.time,video.duration):previous.time;
        video.currentTime=automaticSeek.current;
        video.playbackRate=previous.rate;
        if(!previous.paused)void video.play().catch(()=>{});else video.pause();
        qualityPosition.current=null;controller.abort();remember();
      };
      for(const event of ['loadedmetadata','progress','canplay'])video.addEventListener(event,restore,{signal:controller.signal});
    };
    if(engine.current) {
      const target=new URL(`${next}/index.m3u8`,playbackUrl).href;
      const index=next==='auto'?-1:engine.current.levels.findIndex(level=>level.url.includes(target));
      if(next!=='auto'&&index<0){handleError();return;}
      preservePosition();
      // Recreate MediaSource to discard cached rendition frames and queued EOS callbacks.
      engine.current.loadLevel=index;
      engine.current.recoverMediaError();
    } else if(mode==='native') {
      preservePosition();
      video.src=next==='auto'?playbackUrl:new URL(`${next}/index.m3u8`,playbackUrl).href;video.load();
    } else return;
    qualityRef.current=next;setQuality(next);remember();
  };
  return <div ref={container} tabIndex={0} role="region" aria-label={`${title} — ${labels.togglePlayback}`} className={styles.player}>
    <video ref={videoRef} poster={poster} playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback crossOrigin="use-credentials" aria-label={title} className="h-full w-full object-contain"
      onPlay={()=>{pausedIntent.current=false;setAutoplayBlocked(false);}} onError={handleError}/>
    <PlayerChrome container={container} videoRef={videoRef} playbackUrl={playbackUrl} watermark={watermark} labels={labels} quality={quality} activeHeight={activeHeight} qualities={qualities} previousHref={previousHref} nextHref={nextHref} autoplayBlocked={autoplayBlocked} loading={mode==='loading'} failed={mode==='error'} onQualityChange={changeQuality} onPlaybackChange={value=>{if(value.paused!==undefined)pausedIntent.current=value.paused;if(qualityPosition.current)Object.assign(qualityPosition.current,value);}} onPlayingChange={onPlayingChange} live={playbackMode==='live'?live:undefined} onDvr={dvr} onReturnToLive={returnToLive}/>
  </div>;
}
