import {createAccountSessionClient, createBrowserAccountAuthRuntime} from '@hallelujahhomechurch/account-client';
import {createMemberVideoApi} from '../src/features/member-videos/api';

type Segment = {uri:string;duration:number};
type Grant = {recordingId:string;captureId:string;playbackScopeId:string;issuedAt:string;expiresAt:string;serverNow:string;captureExpiresAt:string;replayUntil:string|null;liveState:string};
const requireValue = (ok:unknown) => {if(!ok)throw new Error('Invalid or unsupported live evidence');};

export function scopedURL(uri:string, base:string, root:string) {
  const url=new URL(uri,base);
  requireValue(url.protocol==='https:' && url.origin===new URL(root).origin && url.pathname.startsWith(new URL(root).pathname) && !url.search && !url.hash && !url.username && !url.password);
  return url.href;
}

export function parsePlaylist(text:string) {
  requireValue(text.length<=1048576 && text.startsWith('#EXTM3U'));
  requireValue(!/#EXT-X-(KEY|MEDIA|BYTERANGE|PART|PRELOAD-HINT):/.test(text));
  const variants:{uri:string;height:number}[]=[],segments:Segment[]=[];
  let height:number|undefined,duration:number|undefined,init:string|undefined;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.trim();
    if(line.startsWith('#EXT-X-STREAM-INF:')) {
      height=Number(/RESOLUTION=\d+x(\d+)/.exec(line)?.[1]);requireValue(Number.isFinite(height) && height>0);
    } else if(line.startsWith('#EXTINF:')) {
      duration=Number(line.slice(8).split(',')[0]);requireValue(Number.isFinite(duration) && duration>0 && duration<=60);
    } else if(line.startsWith('#EXT-X-MAP:')) {
      init=/URI="([^"]+)"/.exec(line)?.[1];requireValue(init);
    } else if(line && !line.startsWith('#')) {
      if(height!==undefined){variants.push({uri:line,height});height=undefined;}
      else {requireValue(duration!==undefined);segments.push({uri:line,duration:duration!});duration=undefined;}
    }
  }
  requireValue(height===undefined && duration===undefined);
  return {variants,segments,init,ended:text.includes('#EXT-X-ENDLIST')};
}

export function validateGrant(g:Grant,id:string,capture:string,scope:string,requestedAt:number) {
  const issued=Date.parse(g.issuedAt),now=Date.parse(g.serverNow),expires=Date.parse(g.expiresAt);
  const remaining=expires-now,ttl=expires-issued,hardEnd=Math.min(Date.parse(g.captureExpiresAt),g.replayUntil?Date.parse(g.replayUntil):Infinity);
  requireValue(g.recordingId===id && g.captureId===capture && g.playbackScopeId===scope &&
    !['failed','expired','aborted'].includes(g.liveState) && ttl>0 && ttl<=300000 && remaining>0 && remaining<=300000 && Number.isFinite(hardEnd) && expires<=hardEnd);
  return {expires:requestedAt+remaining,renew:requestedAt+remaining-Math.min(60000,ttl*.2)};
}

let running=false;

// Explicit invocation only. The bundle is never imported by the product UI.
export async function startPublicLiveLoad(options:{recordingId:string;captureId:string;viewers:number;minutes:number}) {
  requireValue(location.origin==='https://www.alive.org.tw' && !running);
  requireValue(/^[a-f0-9-]{36}$/.test(options.recordingId) && /^[a-f0-9]{32}$/.test(options.captureId));
  requireValue(Number.isInteger(options.viewers) && options.viewers>=1 && options.viewers<=97 && options.minutes>0 && options.minutes<=30);
  running=true;
  const controller=new AbortController(),signal=controller.signal,started=performance.now();
  const ramp=options.viewers>1?30000:0,holdMs=options.minutes*60000;
  let deadline=started+ramp+15000,holdStarted:number|undefined,timer:ReturnType<typeof setTimeout>;
  let finished:number|undefined,holdEnded:number|undefined;
  signal.addEventListener('abort',()=>{holdEnded=performance.now();},{once:true});
  // Browser timers can round down or run late; the monotonic clock owns the boundary.
  const setDeadline=(at:number)=>{
    deadline=at;clearTimeout(timer);
    timer=setTimeout(()=>{
      if(performance.now()<deadline)setDeadline(deadline);
      else controller.abort('deadline');
    },Math.max(1,Math.ceil(at-performance.now())));
  };
  const stats={active:0,completed:0,requests:0,bytes:0,renewals:0,maxRequestMs:0,failure:null as string|null,
    failureDetail:null as {viewer:number;phase:string;code:string}|null};
  const boundedFetch:typeof fetch=async(input,init)=>{
    const method=init?.method ?? (input instanceof Request?input.method:'GET');
    const signals=[init?.signal,input instanceof Request?input.signal:undefined,method==='DELETE'?undefined:signal,AbortSignal.timeout(10000)].filter((s):s is AbortSignal=>!!s);
    const response=await fetch(input,{...init,signal:AbortSignal.any(signals)});
    if(method==='DELETE' && !response.ok)throw new Error('Cookie cleanup rejected');
    return response;
  };
  const session=createBrowserAccountAuthRuntime({client:createAccountSessionClient({baseUrl:'/api/account/v1',fetcher:boundedFetch})});
  const api=createMemberVideoApi(session,boundedFetch);
  const pause=(ms:number)=>new Promise<void>((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},Math.max(0,Math.ceil(Math.min(ms,deadline-performance.now()))));
    signal.addEventListener('abort',abort,{once:true});
  });
  const fail=(reason:string)=>{stats.failure??=reason;controller.abort('failure');};
  const plannedAbort=(error:unknown)=>signal.aborted && ['deadline','operator'].includes(signal.reason) &&
    (error===signal.reason || (error instanceof DOMException && error.name==='AbortError'));
  async function viewer(index:number) {
    const scope=crypto.randomUUID();let media:string|undefined,root='',expires=0,renew=0,active=false,nextAt=0;
    let phase='ramp';
    async function authorize() {
      phase='authorize';
      const requested=performance.now(),g=await api.liveGrant(options.recordingId,options.captureId,scope,signal);
      const times=validateGrant(g,options.recordingId,options.captureId,scope,requested);
      requireValue(performance.now()<times.expires);
      signal.throwIfAborted();const next=await api.exchangeLive(g,signal);
      requireValue(!media || media===next);media=next;root=new URL('.',media).href;
      requireValue(performance.now()<times.expires);expires=times.expires;renew=times.renew;stats.renewals++;
    }
    async function request(uri:string,text=false) {
      phase=text?'playlist':'media';
      if(performance.now()>=deadline)controller.abort('deadline');
      signal.throwIfAborted();requireValue(performance.now()<expires);
      if(++stats.requests>200000)throw new Error('Request budget exceeded');
      const before=performance.now();
      const response=await boundedFetch(scopedURL(uri,media!,root),{credentials:'include',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal});
      if(!response.ok){fail(`MEDIA_HTTP_${response.status}`);throw new Error('Media failed');}
      let bytes=0,value='';const reader=response.body?.getReader(),decoder=new TextDecoder();requireValue(reader);
      try {
        for(;;){
          const chunk=await reader!.read();if(chunk.done)break;bytes+=chunk.value.byteLength;
          requireValue(bytes<=(text?1048576:64*1024*1024));
          if(text)value+=decoder.decode(chunk.value,{stream:true});
        }
        if(text)value+=decoder.decode();
      } catch(error){await reader!.cancel();throw error;}
      requireValue(bytes>0);stats.bytes+=bytes;stats.maxRequestMs=Math.max(stats.maxRequestMs,performance.now()-before);
      if(stats.bytes>120e9)throw new Error('Byte budget exceeded');
      return value;
    }
    try {
      await pause(index*ramp/Math.max(1,options.viewers-1));if(performance.now()>=deadline)return;
      await authorize();
      const master=parsePlaylist(await request(media!,true));requireValue(master.variants.length>0);
      const height=index%10<2?480:index%10<7?720:1080;
      const variant=[...master.variants].sort((a,b)=>Math.abs(a.height-height)-Math.abs(b.height-height))[0];
      const playlist=scopedURL(variant.uri,media!,root);let initialized:string|undefined,lastSegment:string|undefined,first=true;
      while(!signal.aborted && performance.now()<deadline) {
        if(performance.now()>=renew)await authorize();
        const list=parsePlaylist(await request(playlist,true));requireValue(list.variants.length===0 && list.segments.length>0);
        if(list.init && list.init!==initialized){await request(scopedURL(list.init,playlist,root));initialized=list.init;}
        // EVENT includes pre-join history; continue after the last completed URI.
        const anchor=first?-1:list.segments.findIndex(s=>s.uri===lastSegment);requireValue(first||anchor>=0);
        const batch=first?list.segments.slice(-3):list.segments.slice(anchor+1);first=false;
        for(const segment of batch) {
          if(performance.now()>=deadline || signal.aborted)break;
          if(performance.now()>=renew)await authorize();
          await request(scopedURL(segment.uri,playlist,root));lastSegment=segment.uri;
          if(!active){
            // Playback time starts when the first complete fragment is available.
            active=true;nextAt=performance.now();stats.active++;
            if(stats.active===options.viewers){holdStarted=nextAt;setDeadline(holdStarted+holdMs);}
          }
          nextAt+=segment.duration*1000;
          if(performance.now()-nextAt>10000)throw new Error('Generator cannot keep pace');
          await pause(nextAt-performance.now());
        }
        if(list.ended)throw new Error('Live ended before planned hold');
        if(!batch.length && performance.now()>=nextAt+10000)throw new Error('Live segment progress stalled');
        if(!batch.length)await pause(Math.max(1000,list.segments.at(-1)!.duration*500));
      }
      if((!signal.aborted || signal.reason==='deadline') && active && holdStarted!==undefined && performance.now()>=deadline && nextAt>=deadline)stats.completed++;
      else if(signal.reason!=='operator' && !stats.failure)fail('INCOMPLETE_MEDIA_HOLD');
    } catch(error) {
      if(plannedAbort(error)){
        if(signal.reason==='deadline'){
          if(active && holdStarted!==undefined && performance.now()>=deadline && nextAt>=deadline)stats.completed++;
          else if(!stats.failure)fail('INCOMPLETE_MEDIA_HOLD');
        }
      } else if(!stats.failure){
        // Only fixed categories leave memory; errors may contain capability URLs.
        const known:Record<string,string>={'Generator cannot keep pace':'GENERATOR_BEHIND','Live segment progress stalled':'MEDIA_STALLED','Live ended before planned hold':'LIVE_ENDED','Invalid or unsupported live evidence':'INVALID_EVIDENCE','Request budget exceeded':'REQUEST_BUDGET','Byte budget exceeded':'BYTE_BUDGET'};
        const code=error instanceof DOMException&&error.name==='TimeoutError'?'REQUEST_TIMEOUT':error instanceof TypeError?'NETWORK':error instanceof Error&&Object.hasOwn(known,error.message)?known[error.message]:'UNCLASSIFIED';
        stats.failureDetail={viewer:index,phase,code};fail('SESSION_OR_GENERATOR_FAILED');
      }
    }
    finally {
      if(active)stats.active--;
      if(media){try{await api.clearLive(media);}catch{stats.failure??='COOKIE_CLEANUP_FAILED';}}
    }
  }
  try {requireValue((await session.start()).status==='authenticated' && performance.now()<deadline);}
  catch {session.dispose();running=false;throw new Error('Existing member session is unavailable');}
  setDeadline(deadline);
  const done=Promise.all(Array.from({length:options.viewers},(_,index)=>viewer(index))).finally(()=>{finished=performance.now();clearTimeout(timer);session.dispose();running=false;});
  return {
    stop:()=>controller.abort('operator'),
    snapshot:()=>{
      const at=finished??performance.now();
      return {...stats,elapsedSeconds:Math.round((at-started)/1000),holdSeconds:holdStarted===undefined?0:Math.min(holdMs,(holdEnded??at)-holdStarted)/1000,megabitsPerSecond:stats.bytes*8/Math.max(1,at-started)/1000};
    },
    done,
  };
}
