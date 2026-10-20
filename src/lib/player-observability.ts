import * as Sentry from '@sentry/nextjs';

const names=['seeking','waiting','seeked','playing','ratechange','frame','hls-error'];
const types=['unknown','networkError','mediaError','muxError','keySystemError','otherError'];
const details=['unknown','bufferStalledError','bufferSeekOverHole','bufferNudgeOnStall','bufferAppendError','bufferAppendingError','fragLoadError','fragLoadTimeOut','fragParsingError'];
const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;

// Re-project the optional SDK callback at the telemetry trust boundary.
export function sanitizePlayerDiagnostic(value:unknown){
  const batch=object(value);
  if(!batch||batch.version!==1||typeof batch.backend!=='string'||!['hls','native','unknown'].includes(batch.backend)||typeof batch.mode!=='string'||!['live','vod'].includes(batch.mode)||typeof batch.videoFrameSupport!=='string'||!['supported','unsupported'].includes(batch.videoFrameSupport)||!Array.isArray(batch.events))return null;
  const mediaSource=typeof batch.mediaSource==='string'&&['media-source','managed-media-source','none'].includes(batch.mediaSource)?batch.mediaSource:'unknown';
  const events:Record<string,unknown>[]=[];
  for(const value of batch.events.slice(0,24)){
    const event=object(value);if(!event||typeof event.event!=='string'||!names.includes(event.event))continue;
    if(typeof event.elapsedMs!=='number'||!Number.isFinite(event.elapsedMs)||event.elapsedMs<0||event.elapsedMs>8000)continue;
    const safe:Record<string,unknown>={event:event.event,elapsedMs:event.elapsedMs};
    for(const [key,max] of Object.entries({currentTime:604800,rate:16,readyState:4,videoTime:604800,presentedFrames:1e9})){
      const number=event[key];if(typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=max)safe[key]=number;
    }
    for(const key of ['seeking','paused','fatal'])if(typeof event[key]==='boolean')safe[key]=event[key];
    if(event.event==='hls-error'){
      safe.type=typeof event.type==='string'&&types.includes(event.type)?event.type:'unknown';
      safe.details=typeof event.details==='string'&&details.includes(event.details)?event.details:'unknown';
    }
    events.push(safe);
  }
  return events.length?{version:1,backend:batch.backend,mediaSource,mode:batch.mode,videoFrameSupport:batch.videoFrameSupport,events}:null;
}
export function createPlayerDiagnosticReporter(){
  let reports=0;
  return (value:unknown)=>{
    if(reports>=3)return;
    const player=sanitizePlayerDiagnostic(value);if(!player)return;reports++;
    // Preserve bounded values through Sentry's shallow normalization; beforeSend re-projects them.
    try{Sentry.captureMessage('Player seek diagnostic',{level:'info',tags:{player_diagnostic:'seek_v1'},contexts:{player:{observation:JSON.stringify(player)}}});}catch{/* Telemetry must not interrupt playback. */}
  };
}
