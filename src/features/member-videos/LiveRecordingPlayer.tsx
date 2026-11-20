'use client';

import {useCallback, useEffect, useRef, useState,type ReactNode,type ComponentProps} from 'react';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import {VideoInteractions} from './VideoInteractions';
import {usePlaybackProgress} from './usePlaybackProgress';
import {usePlaybackTelemetry} from './usePlaybackTelemetry';
import zoneStyles from './MemberVideoZone.module.css';
import {HlsPlayer,type PlayerLabels} from './HlsPlayer';
import {useLivePlayback} from './useLivePlayback';
import {type PlayerBookmark} from './live-player';
import {LoaderCircle} from 'lucide-react';

import {useLiveRecordingCover,LiveCoverSurface} from './RecordingCover';

export type LiveLabels={starting:string;live:string;recovering:string;interrupted:string;ending:string;ended:string;failed:string;expired:string;aborted:string;backToLive:string;replayUntil:string;watchRecording:string;liveNow?:string;waitingSignal?:string};
export const englishLiveLabels:LiveLabels={liveNow:'Live',starting:'Preparing live video',live:'Live · estimated delay {delay}',recovering:'Catching up',interrupted:'Live connection interrupted',ending:'Finishing live video; you can keep watching',ended:'Live ended; you can keep watching',failed:'Live video is unavailable',expired:'Live replay has expired',aborted:'Live video has stopped',backToLive:'Back to live',replayUntil:'Replay available until {time}',watchRecording:'Continue with the published recording'};

export function liveViewerLabel(state:MemberLiveRecording['liveState'],labels:LiveLabels){return state==='live'||state==='recovering'?labels.liveNow??labels.live:labels[state];}

type Props=Pick<ComponentProps<typeof HlsPlayer>, 'mini' | 'onMinimizeMove'>&{verifyRevision?:number;surfaceOnly?:boolean;onMinimize?:()=>void;recommendations?:ReactNode;mediaOriginSeconds?:number|null;api:ReturnType<typeof createMemberVideoApi>;recording:MemberLiveRecording;labels:PlayerLabels&{retry:string;playError:string;loading:string;description:string};liveLabels:LiveLabels;locale:string;onVod?:(bookmark:PlayerBookmark|undefined)=>Promise<boolean>};
export function LiveRecordingPlayer({api,recording,labels,liveLabels,locale,onVod,recommendations,surfaceOnly,verifyRevision,onMinimize,mini,onMinimizeMove,mediaOriginSeconds:projectionOrigin=0}:Props){
 const [origin,setOrigin]=useState({recordingId:recording.id,captureId:recording.captureId,seconds:projectionOrigin??0});
 const sameCapture=origin.recordingId===recording.id&&origin.captureId===recording.captureId;
 const mediaOriginSeconds=projectionOrigin??(sameCapture?origin.seconds:0);
 // Pending End projections omit the origin; the mounted capture keeps its coordinates.
 if(!sameCapture||origin.seconds!==mediaOriginSeconds)setOrigin({recordingId:recording.id,captureId:recording.captureId,seconds:mediaOriginSeconds});
 const awaitingMedia=recording.liveState==='starting'&&recording.progress.lastSequence<2;
 const playerSection=useRef<HTMLDivElement>(null);
 const video=useRef<HTMLVideoElement>(null),media=useRef<HTMLMediaElement>(null),pause=useRef<(()=>void)|null>(null);
 const stopPlayback=useCallback(()=>{if(pause.current){pause.current();return;}media.current?.pause();if(video.current!==media.current)video.current?.pause();},[]);
 const session=useLivePlayback(api,recording.id,recording.captureId,awaitingMedia,stopPlayback);
 const [mediaError,setMediaError]=useState(false),[playerRevision,setPlayerRevision]=useState(0),[switching,setSwitching]=useState(false),[vodError,setVodError]=useState(false);
 const {remember,start:prepareLive,playback:livePlayback}=session;
 const grant=session.playback?.grant;
 const {revalidate}=session;
 const [verification,setVerification]=useState<{revision:number;requestNumber:number}>();
 if(verification&&verification.revision!==verifyRevision)setVerification(undefined);
 const authorityReady=verifyRevision===undefined||Boolean(livePlayback&&verification?.revision===verifyRevision&&livePlayback.requestNumber>=verification.requestNumber);
 useEffect(()=>{
  if(verifyRevision===undefined)return;
  let current=true;
  void revalidate().then(requestNumber=>{if(current)setVerification({revision:verifyRevision,requestNumber});});
  return()=>{current=false;};
 },[verifyRevision,revalidate]);
 const onBookmark=useCallback((bookmark:PlayerBookmark)=>{remember({...bookmark,mediaOriginSeconds});},[remember,mediaOriginSeconds]);
 const state=grant&&['ending','ended'].includes(grant.liveState)?grant.liveState:recording.liveState;
 const playable=!session.closed&&!['failed','expired','aborted'].includes(state);
 const poster=useLiveRecordingCover(api,recording,playable);
 const prepareProgress=usePlaybackProgress(api,recording.id,`live:${recording.captureId}`,playerSection,media,Boolean(surfaceOnly&&playable));
 useEffect(()=>{if(surfaceOnly&&playable&&!awaitingMedia)void prepareProgress('resume');},[surfaceOnly,playable,awaitingMedia,recording.id,recording.captureId,prepareProgress]);
 useEffect(()=>{if(playable&&!livePlayback)void prepareLive();},[api,recording.id,recording.captureId,playable,awaitingMedia,livePlayback,prepareLive]);
 const verifiedEnd=Math.max(0,Math.max(recording.progress.mediaEndSeconds,grant?.progress.mediaEndSeconds??0)-mediaOriginSeconds);
 const [waitForEnd,setWaitForEnd]=useState<number|null>(null);
 const [recoverForeground,setRecoverForeground]=useState(false);
 const rebuild=useCallback(async()=>{
  if(!await prepareLive()||document.visibilityState==='hidden')return;
  setMediaError(false);setWaitForEnd(null);
  setRecoverForeground(session.bookmark.current?.paused===false);setPlayerRevision(value=>value+1);
 },[prepareLive,session.bookmark]);
 const onError=useCallback((bookmark?:PlayerBookmark,reason?:'foreground-return'|'foreground-rebuild')=>{
  if(bookmark)remember({...bookmark,mediaOriginSeconds});
  setMediaError(true);
  if(reason!=='foreground-return'||!playable)return;
  if(bookmark&&!bookmark.paused&&bookmark.time>=verifiedEnd-.1&&(state==='live'||state==='recovering')){
   setWaitForEnd(verifiedEnd);return;
  }
  void rebuild();
 },[remember,mediaOriginSeconds,playable,verifiedEnd,state,rebuild]);
 useEffect(()=>{
  if(waitForEnd===null||!playable)return;
  let resumed=false;
  const resume=()=>{
   if(resumed||document.hidden||!(verifiedEnd>waitForEnd||state==='ending'||state==='ended'))return;
   resumed=true;setWaitForEnd(null);void rebuild();
  };
  resume();document.addEventListener('visibilitychange',resume);
  return()=>document.removeEventListener('visibilitychange',resume);
 },[waitForEnd,playable,verifiedEnd,state,rebuild]);
 usePlaybackTelemetry(api,recording.id,media,Boolean(session.playback&&playable));
 const continueVod=async()=>{if(!onVod||switching)return;setSwitching(true);setVodError(false);try{setVodError(!await onVod(session.bookmark.current));}catch{setVodError(true);}finally{setSwitching(false);}};
 const retry=()=>{
  if(!authorityReady)return prepareLive();
  setWaitForEnd(null);return mediaError?rebuild():prepareLive();
 };
 return <div ref={playerSection} data-video-watch className={`${zoneStyles.video} grid min-w-0 gap-4`}>
  {session.playback&&playable&&authorityReady?<HlsPlayer key={`${session.playback.url}:${playerRevision}`} playbackMode="live" recoverForeground={recoverForeground} mini={mini} onMinimizeMove={onMinimizeMove} onMinimize={onMinimize} onPlayIntent={kind=>{void prepareProgress(kind);}} backgroundAudioUrl={new URL('480p/index.m3u8',session.playback.url).href} playbackMediaRef={media} playbackPauseRef={pause} poster={poster} playbackUrl={session.playback.url} videoRef={video} title={recording.title} labels={labels} availableQualities={['480p','720p','1080p']} watermark={session.playback.grant.watermarkCode} onError={onError} onBookmark={onBookmark} resume={session.bookmark.current} live={{verifiedEnd,ended:state==='ending'||state==='ended',canFollow:state==='live'||state==='recovering',label:liveViewerLabel(state,liveLabels),backToLive:liveLabels.backToLive,liveLabel:liveLabels.liveNow??liveLabels.live}}/>:<div className={`relative isolate grid aspect-video place-items-center overflow-hidden ${surfaceOnly ? 'rounded-[inherit]' : 'rounded-[14px]'} bg-neutral-950 text-white`}><div className="absolute inset-0 -z-10" aria-hidden="true"><LiveCoverSurface url={poster} title={recording.title}/></div>
   {playable?(session.exhausted&&awaitingMedia?<div role="status">{liveLabels.waitingSignal??liveLabels.starting} <button type="button" className="min-h-11 underline" onClick={()=>void retry()}>{labels.retry}</button></div>:session.pending||!session.error?<div className="hhc-player-loading" role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{labels.loading}</span></div>:<p>{labels.playError}</p>):<p role="status">{session.closed?(session.expired?liveLabels.expired:liveLabels.failed):liveLabels[state]}</p>}
  </div>}
  {!surfaceOnly && <><h2 className={zoneStyles.watchTitle}>{recording.title}</h2>
  <VideoInteractions recommendations={recommendations} key={recording.id} api={api} id={recording.id} publicId={recording.publicId} title={recording.title} locale={locale} live={state==='live'||state==='recovering'} description={recording.description} date={recording.startedAt??recording.createdAt} dateKind="live">
  {!['live','recovering'].includes(state)||session.closed?<p role="status" className="text-sm text-muted">{session.closed?(session.expired?liveLabels.expired:liveLabels.failed):liveLabels[state]}</p>:null}
  {grant?.replayUntil?<p className="text-sm text-muted">{liveLabels.replayUntil.replace('{time}',new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(grant.replayUntil)))}</p>:null}
  </VideoInteractions></>}
  {onVod?<button type="button" disabled={switching} className="min-h-11 justify-self-start rounded-full border border-panel-border px-5 text-ink disabled:opacity-50" onClick={()=>void continueVod()}>{liveLabels.watchRecording}</button>:null}
  {vodError?<p role="alert" className="text-sm text-primary">{labels.playError} <button type="button" className="min-h-11 underline" disabled={switching} onClick={()=>void continueVod()}>{labels.retry}</button></p>:null}
  {waitForEnd!==null&&playable?<p role="status">{liveLabels.waitingSignal??liveLabels.starting} <button type="button" className="min-h-11 underline" disabled={session.pending} onClick={()=>void retry()}>{labels.retry}</button></p>:(session.error||mediaError)&&!session.closed?<p role="alert" className="text-sm text-primary">{labels.playError} <button type="button" className="min-h-11 underline" disabled={session.pending} onClick={()=>void retry()}>{labels.retry}</button></p>:null}
 </div>;
}
