type Event='loadedmetadata'|'waiting'|'stalled'|'playing'|'pause'|'ratechange'|'seeking'|'seeked'|'timeupdate'|'visibility'|'renew'|'exchange-start'|'exchange-end'|'accepted'|'expired'|'denied'|'error';
type Sample={event:Event;elapsedMs:number;visibility:DocumentVisibilityState;generation:number;expiresInSeconds?:number;currentTime?:number;rate?:number;paused?:boolean;readyState?:number;buffered?:number[][]};
declare global {interface Window {hhcPlaybackDiagnostics?:{events:Sample[]}}}
// Opt-in, in-memory diagnostics only; never collect URLs, identities or credentials.
export function createPlaybackDiagnostics(){
 let enabled=false;
 try{enabled=typeof window!=='undefined'&&sessionStorage.getItem('hhc.playbackDiagnostics')==='1';}catch{}
 const samples:Sample[]=[];let lastProgress=-Infinity;
 if(enabled)window.hhcPlaybackDiagnostics={events:samples};
 return (event:Event,media:HTMLMediaElement|null,generation:number,expiresInSeconds?:number)=>{
  if(!enabled)return;
  try{
  const now=performance.now();if(event==='timeupdate'){if(now-lastProgress<30000)return;lastProgress=now;}
  const value:Sample={event,elapsedMs:Math.round(now),visibility:document.visibilityState,generation};
  if(expiresInSeconds!==undefined&&Number.isFinite(expiresInSeconds))value.expiresInSeconds=Math.max(0,Math.min(3600,expiresInSeconds));
  if(media){
   if(Number.isFinite(media.currentTime))value.currentTime=Math.max(0,Math.min(604800,media.currentTime));
   if(Number.isFinite(media.playbackRate))value.rate=Math.max(0,Math.min(16,media.playbackRate));
   value.paused=media.paused;value.readyState=media.readyState;value.buffered=[];
   const ranges=media.buffered;for(let i=0;i<Math.min(4,ranges.length);i++)value.buffered.push([ranges.start(i),ranges.end(i)]);
  }
  samples.push(value);if(samples.length>256)samples.shift();
  }catch{/* Diagnostics never interrupt playback or authorization cleanup. */}
 };
}
