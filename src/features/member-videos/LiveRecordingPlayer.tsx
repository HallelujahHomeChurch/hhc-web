'use client';

import {useCallback, useRef, useState} from 'react';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import zoneStyles from './MemberVideoZone.module.css';
import {HlsPlayer,type PlayerLabels} from './HlsPlayer';
import {useLivePlayback} from './useLivePlayback';
import type {PlayerBookmark} from './live-player';

export type LiveLabels={starting:string;live:string;recovering:string;interrupted:string;ending:string;ended:string;failed:string;expired:string;aborted:string;backToLive:string;replayUntil:string;watchRecording:string;liveNow?:string};
export const englishLiveLabels:LiveLabels={liveNow:'Live',starting:'Preparing live video',live:'Live · about 1–2 minutes behind',recovering:'Catching up',interrupted:'Live connection interrupted',ending:'Finishing live video; you can keep watching',ended:'Live ended; you can keep watching',failed:'Live video is unavailable',expired:'Live replay has expired',aborted:'Live video has stopped',backToLive:'Back to live',replayUntil:'Replay available until {time}',watchRecording:'Continue with the published recording'};

type Props={api:ReturnType<typeof createMemberVideoApi>;recording:MemberLiveRecording;labels:PlayerLabels&{retry:string;playError:string;loading:string;description:string};liveLabels:LiveLabels;locale:string;onVod?:(bookmark:PlayerBookmark|undefined)=>Promise<boolean>};
export function LiveRecordingPlayer({api,recording,labels,liveLabels,locale,onVod}:Props){
 const session=useLivePlayback(api,recording.id,recording.captureId),video=useRef<HTMLVideoElement>(null);
 const [mediaError,setMediaError]=useState(false),[playerRevision,setPlayerRevision]=useState(0),[switching,setSwitching]=useState(false);
 const onError=useCallback(()=>{setMediaError(true);},[]);
 const grant=session.playback?.grant;
 const state=grant&&['ending','ended'].includes(grant.liveState)?grant.liveState:recording.liveState;
 const playable=!session.closed&&!['failed','expired','aborted'].includes(state);
 const verifiedEnd=Math.max(recording.progress.mediaEndSeconds,grant?.progress.mediaEndSeconds??0);
 const retry=async()=>{const rebuild=mediaError;setMediaError(false);await session.start();if(rebuild)setPlayerRevision(value=>value+1);};
 return <div className={`${zoneStyles.video} grid min-w-0 gap-4`}>
  {session.playback&&playable?<HlsPlayer key={`${session.playback.url}:${playerRevision}`} playbackMode="live" playbackUrl={session.playback.url} videoRef={video} title={recording.title} labels={labels} availableQualities={['480p','720p','1080p']} watermark={session.playback.grant.watermarkCode} onError={onError} onBookmark={session.remember} resume={session.bookmark.current} live={{verifiedEnd,canFollow:state==='live',label:liveLabels[state],backToLive:liveLabels.backToLive,liveLabel:liveLabels.liveNow??liveLabels.live}}/>:<div className="grid aspect-video place-items-center rounded-[14px] bg-neutral-950 text-white">
   {session.pending?<p role="status">{labels.loading}</p>:playable?<button type="button" className="min-h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground" onClick={()=>void retry()}>{session.error?labels.retry:labels.play}</button>:<p role="status">{liveLabels[state]}</p>}
  </div>}
  <h2 className="text-2xl font-semibold text-ink">{recording.title}</h2>
  <p role="status" className="text-sm text-muted">{session.closed?liveLabels.expired:liveLabels[state]}</p>
  {grant?.replayUntil?<p className="text-sm text-muted">{liveLabels.replayUntil.replace('{time}',new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(grant.replayUntil)))}</p>:null}
  {recording.description?<details className="rounded-[14px] bg-panel p-5 text-ink"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">{labels.description}</summary><p className="whitespace-pre-wrap break-words">{recording.description}</p></details>:null}
  {onVod?<button type="button" disabled={switching} className="min-h-11 justify-self-start rounded-full border border-panel-border px-5 text-ink disabled:opacity-50" onClick={async()=>{setSwitching(true);try{if(!await onVod(session.bookmark.current))setMediaError(true);}finally{setSwitching(false);}}}>{liveLabels.watchRecording}</button>:null}
  {(session.error||mediaError)&&!session.closed?<p role="alert" className="text-sm text-primary">{labels.playError} <button type="button" className="min-h-11 underline" disabled={session.pending} onClick={()=>void retry()}>{labels.retry}</button></p>:null}
 </div>;
}
