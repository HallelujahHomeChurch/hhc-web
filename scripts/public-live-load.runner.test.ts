import {afterEach, expect, it, vi} from 'vitest';
const api=vi.hoisted(()=>({liveGrant:vi.fn(),exchangeLive:vi.fn(),clearLive:vi.fn(),fetcher:undefined as typeof fetch|undefined}));
vi.mock('../src/features/member-videos/api',()=>({createMemberVideoApi:(_authorization:unknown,fetcher:typeof fetch)=>{api.fetcher=fetcher;return api;}}));
vi.mock('@hallelujahhomechurch/account-client',()=>({createAccountSessionClient:vi.fn(),createBrowserAccountAuthRuntime:()=>({start:async()=>({status:'authenticated'}),dispose:vi.fn()})}));
import {startPublicLiveLoad} from './public-live-load';
const recordingId='00000000-0000-4000-8000-000000000001',captureId='0123456789abcdef0123456789abcdef';
const scope='00000000-0000-4000-8000-000000000002';
const root=`https://media.alive.org.tw/videos/${recordingId}/captures/${captureId}/sessions/${scope}/`;
function setup(status=200){
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']});
 vi.stubGlobal('location',{origin:'https://www.alive.org.tw'});
 api.liveGrant.mockImplementation(async(id,capture,scopeId)=>({recordingId:id,captureId:capture,playbackScopeId:scopeId,issuedAt:'2026-10-20T00:00:00Z',serverNow:'2026-10-20T00:00:00Z',expiresAt:'2026-10-20T00:05:00Z',captureExpiresAt:'2026-10-20T01:00:00Z',replayUntil:null,liveState:'live'}));
 api.exchangeLive.mockResolvedValue(root+'master.m3u8');api.clearLive.mockResolvedValue(undefined);
 const fetcher=vi.fn(async(input:string,init?:RequestInit)=>{void init;return new Response(input.endsWith('master.m3u8')?'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720p/index.m3u8':input.endsWith('index.m3u8')?'#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:10,\nseg-000001.m4s':'complete object bytes',{status});});
 vi.stubGlobal('fetch',fetcher);return fetcher;
}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
it('drains complete media bodies with credentials, holds by EXTINF, clears only its own scope',async()=>{
 const fetcher=setup();const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(601);await load.done;
 expect(fetcher).toHaveBeenCalledTimes(5);
 expect(fetcher.mock.calls.every(([,init])=>init?.credentials==='include' && init?.redirect==='error')).toBe(true);
 expect(api.clearLive).toHaveBeenCalledExactlyOnceWith(root+'master.m3u8');
 expect(load.snapshot()).toMatchObject({active:0,completed:1,requests:5,cleanupCompleted:1,cleanupFailed:0,failure:null});
 expect(load.snapshot().bytes).toBeGreaterThan(40);
});
it('stops all traffic after a denied media response without retrying or leaking a raw URL',async()=>{
 const fetcher=setup(403);const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(1);await load.done;
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(load.snapshot()).toMatchObject({active:0,completed:0,failure:'MEDIA_HTTP_403'});
 expect(JSON.stringify(load.snapshot())).not.toContain(recordingId);
});
it('operator stop cancels paced loops and retains bounded cleanup',async()=>{
 const fetcher=setup();const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(1);const requests=fetcher.mock.calls.length;load.stop();await load.done;
 await vi.advanceTimersByTimeAsync(60000);
 expect(fetcher).toHaveBeenCalledTimes(requests);expect(api.clearLive).toHaveBeenCalledOnce();
 expect(load.snapshot()).toMatchObject({active:0,completed:0});
});

it('rejects stale all-200 playlists rather than certifying idle sessions',async()=>{
 setup();const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(21000);await load.done;
 expect(load.snapshot()).toMatchObject({active:0,completed:0,failure:'SESSION_OR_GENERATOR_FAILED'});
 expect(load.snapshot()).toHaveProperty('failureDetail.code','MEDIA_STALLED');
});
it.each([['TimeoutError','REQUEST_TIMEOUT'],['TypeError','NETWORK'],['Error','UNCLASSIFIED']])('records a safe failure category for %s without saving error text or URLs',async(name,code)=>{
 setup();const secret='https://private.example/capability?token=secret';
 vi.stubGlobal('fetch',vi.fn(async()=>{throw name==='TypeError'?new TypeError(secret):name==='TimeoutError'?new DOMException(secret,name):new Error(secret);}));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(1);await load.done;
 expect(load.snapshot()).toHaveProperty('failureDetail',{viewer:0,phase:'playlist',code});
 expect(JSON.stringify(load.snapshot())).not.toContain(secret);
 expect(api.clearLive).toHaveBeenCalledOnce();
});
it('detects a rejected DELETE through the real media API wrapper',async()=>{
 const original=setup();const {createMemberVideoApi}=await vi.importActual<typeof import('../src/features/member-videos/api')>('../src/features/member-videos/api');
 api.clearLive.mockImplementationOnce((url:string)=>createMemberVideoApi({getAccessToken:async()=>null,refreshAfterUnauthorized:async()=>null},api.fetcher!).clearLive(url));
 vi.stubGlobal('fetch',vi.fn((input:string,init?:RequestInit)=>init?.method==='DELETE'?Promise.resolve(new Response(null,{status:500})):original(input,init)));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(601);await load.done;
 expect(load.snapshot()).toMatchObject({failure:'COOKIE_CLEANUP_FAILED',cleanupCompleted:0,cleanupFailed:1});
});
it('keeps cleanup failure visible when a media failure already exists',async()=>{
 setup(403);api.clearLive.mockRejectedValueOnce(new TypeError('private cleanup error'));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(1);await load.done;
 expect(load.snapshot()).toMatchObject({failure:'MEDIA_HTTP_403',cleanupCompleted:0,cleanupFailed:1});
 expect(JSON.stringify(load.snapshot())).not.toContain('private cleanup error');
});
it('aborts an in-flight media request at the overall deadline, then cleans up',async()=>{
 setup();vi.stubGlobal('fetch',vi.fn((_input:string,init?:RequestInit)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true}))));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(15001);await load.done;
 expect(load.snapshot()).toMatchObject({active:0,completed:0,failure:'INCOMPLETE_MEDIA_HOLD'});expect(api.clearLive).toHaveBeenCalledOnce();
});
it.each([{latency:10,initialLatency:10},{latency:350,initialLatency:350},{latency:350,initialLatency:50}])('completes every viewer across a ten-minute fractional-segment live hold with latency $latency and initial $initialLatency',async({latency,initialLatency})=>{
 setup();let requests=0;
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const delay=++requests<=4?initialLatency:latency;
  await new Promise<void>((resolve,reject)=>{
   const signal=init?.signal;
   const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
   const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},delay);
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  });
  const newest=2+Math.floor(performance.now()/10010);
  const segments=Array.from({length:newest+1},(_,i)=>`#EXTINF:10.01,\nseg-${String(i).padStart(6,'0')}.m4s`).join('\n');
  return new Response(input.endsWith('master.m3u8')?'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720p/index.m3u8':input.endsWith('index.m3u8')?`#EXTM3U\n#EXT-X-TARGETDURATION:11\n#EXT-X-MAP:URI="init.mp4"\n${segments}`:'complete object bytes');
 }));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:8,minutes:10});
 await vi.advanceTimersByTimeAsync(640000);await load.done;
 expect(load.snapshot()).toMatchObject({active:0,completed:8,cleanupCompleted:8,cleanupFailed:0,failure:null});
 expect(api.liveGrant.mock.calls.length).toBeGreaterThan(16);
 expect(api.clearLive).toHaveBeenCalledTimes(8);
});
it.each([true,false])('follows appended EVENT media without replaying long history (advancing=%s)',async(advancing)=>{
 setup();const requested:number[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  const sequence=/seg-(\d+)\.m4s$/.exec(input);if(sequence)requested.push(Number(sequence[1]));
  const newest=1200+(advancing?Math.floor(performance.now()/10010):0);
  const segments=Array.from({length:newest+1},(_,i)=>`#EXTINF:10.01,\nseg-${String(i).padStart(6,'0')}.m4s`).join('\n');
  return new Response(input.endsWith('master.m3u8')?'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720p/index.m3u8':input.endsWith('index.m3u8')?`#EXTM3U\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXT-X-TARGETDURATION:11\n#EXT-X-MAP:URI="init.mp4"\n${segments}`:'complete object bytes');
 }));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(75000);await load.done;
 expect(requested).toEqual(advancing?[1198,1199,1200,1201,1202,1203,1204]:[1198,1199,1200]);
 expect(load.snapshot()).toMatchObject(advancing?{completed:1,failure:null}:{completed:0,failureDetail:{code:'MEDIA_STALLED'}});
});
it('fails closed if the last completed EVENT segment disappears',async()=>{
 const original=setup();let playlists=0;
 const fetcher=vi.fn(async(input:string,init?:RequestInit)=>{
  const response=await original(input,init);
  return input.endsWith('index.m3u8')&&++playlists>1?new Response((await response.text()).replace('seg-000001','seg-000002')):response;
 });vi.stubGlobal('fetch',fetcher);
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(35000);await load.done;
 expect(load.snapshot()).toMatchObject({completed:0,failureDetail:{phase:'playlist',code:'INVALID_EVIDENCE'}});
 expect(fetcher.mock.calls.some(([url])=>url.endsWith('seg-000002.m4s'))).toBe(false);
 expect(api.clearLive).toHaveBeenCalledOnce();
});
it('freezes failed-run elapsed time, media hold and goodput after cleanup',async()=>{
 setup();api.clearLive.mockImplementationOnce(()=>new Promise(resolve=>setTimeout(resolve,2000)));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(21000);const failedHold=load.snapshot().holdSeconds;
 await vi.advanceTimersByTimeAsync(2000);await load.done;
 expect(load.snapshot().holdSeconds).toBe(failedHold);
 const stopped=load.snapshot();expect(stopped.failure).not.toBeNull();
 await vi.advanceTimersByTimeAsync(600000);
 expect(load.snapshot()).toEqual(stopped);
});

it.each([{duration:10,completed:1,failure:null},{duration:.1,completed:0,failure:'INCOMPLETE_MEDIA_HOLD'}])('requires media coverage when the hold clock reaches its deadline before the abort timer runs: $duration',async({duration,completed,failure})=>{
 const original=setup();
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const response=await original(input,init);
  return input.endsWith('index.m3u8')?new Response((await response.text()).replace('#EXTINF:10,',`#EXTINF:${duration},`)):response;
 }));
 const schedule=setTimeout;let delayed=false;
 vi.spyOn(globalThis,'setTimeout').mockImplementation(((callback:()=>void,ms?:number,...args:unknown[])=>{
  if(ms===600 && !delayed){delayed=true;return schedule(callback,ms+10,...args);}
  return schedule(callback,ms,...args);
 }) as typeof setTimeout);
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(601);await load.done;
 expect(delayed).toBe(true);
 expect(load.snapshot()).toMatchObject({active:0,completed,failure});
 expect(api.clearLive).toHaveBeenCalledOnce();
});

it('classifies a crossed request deadline before a delayed abort callback without starting media',async()=>{
 const fetcher=setup(),schedule=setTimeout;let delayed=false;
 vi.spyOn(globalThis,'setTimeout').mockImplementation(((callback:()=>void,ms?:number,...args:unknown[])=>{
  if(ms===15000 && !delayed){delayed=true;return schedule(callback,ms+10,...args);}
  return schedule(callback,ms,...args);
 }) as typeof setTimeout);
 api.exchangeLive.mockImplementationOnce(async()=>{await new Promise(resolve=>setTimeout(resolve,15000));return root+'master.m3u8';});
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(15001);await load.done;
 expect(fetcher).not.toHaveBeenCalled();
 expect(load.snapshot()).toMatchObject({active:0,completed:0,failure:'INCOMPLETE_MEDIA_HOLD'});
 expect(api.clearLive).toHaveBeenCalledOnce();
});

it('does not end a fully covered hold when the browser rounds the abort timer down',async()=>{
 setup();const schedule=setTimeout;let rounded=false;
 vi.spyOn(globalThis,'setTimeout').mockImplementation(((callback:()=>void,ms?:number,...args:unknown[])=>{
  if(ms===600 && !rounded){rounded=true;return schedule(callback,ms-.5,...args);}
  return schedule(callback,ms,...args);
 }) as typeof setTimeout);
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(601);await load.done;
 expect(rounded).toBe(true);
 expect(load.snapshot()).toMatchObject({active:0,completed:1,failure:null,holdSeconds:.6});
});
