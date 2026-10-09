'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import zoneStyles from './MemberVideoZone.module.css';
import {HlsPlayer,type PlayerLabels} from './HlsPlayer';
import {useLivePlayback} from './useLivePlayback';
import type {PlayerBookmark} from './live-player';
import {LoaderCircle} from 'lucide-react';
import playerStyles from './PlayerChrome.module.css';

export type LiveLabels={starting:string;live:string;recovering:string;interrupted:string;ending:string;ended:string;failed:string;expired:string;aborted:string;backToLive:string;replayUntil:string;watchRecording:string;liveNow?:string};
export const englishLiveLabels:LiveLabels={liveNow:'Live',starting:'Preparing live video',live:'Live · about 1–2 minutes behind',recovering:'Catching up',interrupted:'Live connection interrupted',ending:'Finishing live video; you can keep watching',ended:'Live ended; you can keep watching',failed:'Live video is unavailable',expired:'Live replay has expired',aborted:'Live video has stopped',backToLive:'Back to live',replayUntil:'Replay available until {time}',watchRecording:'Continue with the published recording'};

export function liveViewerLabel(state:MemberLiveRecording['liveState'],labels:LiveLabels){return state==='live'||state==='recovering'?labels.liveNow??labels.live:labels[state];}

type Props={api:ReturnType<typeof createMemberVideoApi>;recording:MemberLiveRecording;labels:PlayerLabels&{retry:string;playError:string;loading:string;description:string};liveLabels:LiveLabels;locale:string;onVod?:(bookmark:PlayerBookmark|undefined)=>Promise<boolean>};
export function LiveRecordingPlayer({api,recording,labels,liveLabels,locale,onVod}:Props){
 const awaitingMedia=recording.liveState==='starting'&&recording.progress.lastSequence<2;
 const session=useLivePlayback(api,recording.id,recording.captureId,awaitingMedia),video=useRef<HTMLVideoElement>(null);
 const [mediaError,setMediaError]=useState(false),[playerRevision,setPlayerRevision]=useState(0),[switching,setSwitching]=useState(false);
 const {remember,start:prepareLive,playback:livePlayback}=session;
 const onError=useCallback((bookmark?:PlayerBookmark)=>{if(bookmark)remember(bookmark);setMediaError(true);},[remember]);
 const grant=session.playback?.grant;
 const state=grant&&['ending','ended'].includes(grant.liveState)?grant.liveState:recording.liveState;
 const playable=!session.closed&&!['failed','expired','aborted'].includes(state);
 useEffect(()=>{if(playable&&!livePlayback)void prepareLive();},[api,recording.id,recording.captureId,playable,awaitingMedia,livePlayback,prepareLive]);
 const verifiedEnd=Math.max(recording.progress.mediaEndSeconds,grant?.progress.mediaEndSeconds??0);
 const retry=async()=>{const rebuild=mediaError;setMediaError(false);await session.start();if(rebuild)setPlayerRevision(value=>value+1);};
 return <div className={`${zoneStyles.video} grid min-w-0 gap-4`}>
  {session.playback&&playable?<HlsPlayer key={`${session.playback.url}:${playerRevision}`} playbackMode="live" playbackUrl={session.playback.url} videoRef={video} title={recording.title} labels={labels} availableQualities={['480p','720p','1080p']} watermark={session.playback.grant.watermarkCode} onError={onError} onBookmark={session.remember} resume={session.bookmark.current} live={{verifiedEnd,canFollow:state==='live',label:liveViewerLabel(state,liveLabels),backToLive:liveLabels.backToLive,liveLabel:liveLabels.liveNow??liveLabels.live}}/>:<div className="relative grid aspect-video place-items-center rounded-[14px] bg-neutral-950 text-white">
   {playable?(session.pending||!session.error?<div className={playerStyles.loading} role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{labels.loading}</span></div>:<p>{labels.playError}</p>):<p role="status">{session.closed?liveLabels.expired:liveLabels[state]}</p>}
  </div>}
  <h2 className="text-2xl font-semibold text-ink">{recording.title}</h2>
  {session.closed||state!=='recovering'?<p role="status" className="text-sm text-muted">{session.closed?liveLabels.expired:liveLabels[state]}</p>:null}
  {grant?.replayUntil?<p className="text-sm text-muted">{liveLabels.replayUntil.replace('{time}',new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(grant.replayUntil)))}</p>:null}
  {recording.description?<details className="rounded-[14px] bg-panel p-5 text-ink"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">{labels.description}</summary><p className="whitespace-pre-wrap break-words">{recording.description}</p></details>:null}
  {onVod?<button type="button" disabled={switching} className="min-h-11 justify-self-start rounded-full border border-panel-border px-5 text-ink disabled:opacity-50" onClick={async()=>{setSwitching(true);try{if(!await onVod(session.bookmark.current))setMediaError(true);}finally{setSwitching(false);}}}>{liveLabels.watchRecording}</button>:null}
  {(session.error||mediaError)&&!session.closed?<p role="alert" className="text-sm text-primary">{labels.playError} <button type="button" className="min-h-11 underline" disabled={session.pending} onClick={()=>void retry()}>{labels.retry}</button></p>:null}
 </div>;
}
