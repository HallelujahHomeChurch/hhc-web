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
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
it('drains complete media bodies with credentials, holds by EXTINF, clears only its own scope',async()=>{
 const fetcher=setup();const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(601);await load.done;
 expect(fetcher).toHaveBeenCalledTimes(4);
 expect(fetcher.mock.calls.every(([,init])=>init?.credentials==='include' && init?.redirect==='error')).toBe(true);
 expect(api.clearLive).toHaveBeenCalledExactlyOnceWith(root+'master.m3u8');
 expect(load.snapshot()).toMatchObject({active:0,completed:1,requests:4,failure:null});
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
 expect(load.snapshot().active).toBe(0);
});

it('rejects stale all-200 playlists rather than certifying idle sessions',async()=>{
 setup();const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:1});
 await vi.advanceTimersByTimeAsync(21000);await load.done;
 expect(load.snapshot()).toMatchObject({active:0,completed:0,failure:'SESSION_OR_GENERATOR_FAILED'});
});
it('detects a rejected DELETE through the real media API wrapper',async()=>{
 const original=setup();const {createMemberVideoApi}=await vi.importActual<typeof import('../src/features/member-videos/api')>('../src/features/member-videos/api');
 api.clearLive.mockImplementationOnce((url:string)=>createMemberVideoApi({getAccessToken:async()=>null,refreshAfterUnauthorized:async()=>null},api.fetcher!).clearLive(url));
 vi.stubGlobal('fetch',vi.fn((input:string,init?:RequestInit)=>init?.method==='DELETE'?Promise.resolve(new Response(null,{status:500})):original(input,init)));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(601);await load.done;
 expect(load.snapshot().failure).toBe('COOKIE_CLEANUP_FAILED');
});
it('aborts an in-flight media request at the overall deadline, then cleans up',async()=>{
 setup();vi.stubGlobal('fetch',vi.fn((_input:string,init?:RequestInit)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true}))));
 const load=await startPublicLiveLoad({recordingId,captureId,viewers:1,minutes:.01});
 await vi.advanceTimersByTimeAsync(15001);await load.done;
 expect(load.snapshot()).toMatchObject({active:0,completed:0,failure:'INCOMPLETE_MEDIA_HOLD'});expect(api.clearLive).toHaveBeenCalledOnce();
});
