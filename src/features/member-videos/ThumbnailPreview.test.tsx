import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {MemberRecording,MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import {ThumbnailPreview} from './ThumbnailPreview';
import type {createMemberVideoApi} from './api';
import type {PlayerLabels} from './HlsPlayer';
const {player}=vi.hoisted(()=>({player:vi.fn()}));
vi.mock('./HlsPlayer',()=>({HlsPlayer:(props:unknown)=>{player(props);return <video data-testid="preview-video"/>;}}));
const pkg='a'.repeat(32),labels={} as PlayerLabels;
const record=(id:string)=>({id,title:id,packageId:pkg}) as MemberRecording;
let observer:(entries:{isIntersecting:boolean}[])=>void;
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-18T00:00:00Z'));player.mockReset();
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));
 vi.stubGlobal('IntersectionObserver',class {constructor(callback:typeof observer){observer=callback;}observe(){}disconnect(){}});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(){
 const api={grant:vi.fn(async(id:string,scope:string)=>({mediaUrl:`https://media.alive.org.tw/videos/${id}/packages/${pkg}/sessions/${scope}/master.m3u8`,packageId:pkg,expiresAt:new Date(Date.now()+3600000).toISOString(),watermarkCode:'trace',renditions:[{name:'480p'}]}) as MemberRecordingPlayback),exchange:vi.fn(async(grant:MemberRecordingPlayback)=>grant.mediaUrl),clear:vi.fn().mockResolvedValue(undefined),heartbeat:vi.fn()};
 function Cards(){const [active,onActive]=useState<string|null>(null);return <>{['one','two'].map(id=><ThumbnailPreview key={id} api={api as unknown as ReturnType<typeof createMemberVideoApi>} recording={record(id)} labels={labels} enabled activeId={active} onActive={onActive}><span role="img" aria-label={id}/></ThumbnailPreview>)}</>;}
 const view=render(<Cards/>);return {api,...view};
}
async function hover(id='one'){fireEvent.pointerEnter(screen.getByLabelText(id).parentElement!);await act(()=>vi.advanceTimersByTimeAsync(500));}
it('waits for desktop dwell, uses muted 480p shared player and sends no metrics',async()=>{
 const {api}=setup();fireEvent.pointerEnter(screen.getByLabelText('one').parentElement!);await act(()=>vi.advanceTimersByTimeAsync(499));expect(api.grant).not.toHaveBeenCalled();await act(()=>vi.advanceTimersByTimeAsync(1));
 expect(screen.getAllByTestId('preview-video')).toHaveLength(1);expect(player.mock.calls.at(-1)?.[0]).toMatchObject({muted:true,controls:false,initialQuality:'480p',watermark:'trace'});expect(api.heartbeat).not.toHaveBeenCalled();
});
it('allows only one active card and releases each private scope on leave',async()=>{
 const {api}=setup();await hover();await hover('two');expect(screen.getAllByTestId('preview-video')).toHaveLength(1);expect(api.clear).toHaveBeenCalledTimes(1);
 fireEvent.pointerLeave(screen.getByLabelText('two').parentElement!);expect(screen.queryByTestId('preview-video')).toBeNull();expect(api.clear).toHaveBeenCalledTimes(2);
});
it('preserves the next card dwell when pointer leave and enter occur in one event batch',async()=>{
 const {api}=setup();await hover();act(()=>{fireEvent.pointerLeave(screen.getByLabelText('one').parentElement!);fireEvent.pointerEnter(screen.getByLabelText('two').parentElement!);});
 await act(()=>vi.advanceTimersByTimeAsync(500));expect(api.grant).toHaveBeenCalledTimes(2);expect(api.clear).toHaveBeenCalledTimes(1);expect(screen.getAllByTestId('preview-video')).toHaveLength(1);
});
it('does not request media on a coarse pointer or brief hover',async()=>{
 const {api}=setup();vi.mocked(window.matchMedia).mockReturnValue({matches:false} as MediaQueryList);await hover();expect(api.grant).not.toHaveBeenCalled();
 vi.mocked(window.matchMedia).mockReturnValue({matches:true} as MediaQueryList);fireEvent.pointerEnter(screen.getByLabelText('one').parentElement!);fireEvent.pointerLeave(screen.getByLabelText('one').parentElement!);await act(()=>vi.advanceTimersByTimeAsync(500));expect(api.grant).not.toHaveBeenCalled();
});
it.each(['background','offscreen'])('releases playback when %s',async(reason)=>{
 const {api}=setup();await hover('two');
 act(()=>{if(reason==='offscreen')observer([{isIntersecting:false}]);else {vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));}});
 expect(screen.queryByTestId('preview-video')).toBeNull();expect(api.clear).toHaveBeenCalledTimes(1);
});
it('cleans up a late exchange without reviving the departed card',async()=>{
 const {api}=setup();let finish!:(url:string)=>void;api.exchange.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));await hover();const grant=await api.grant.mock.results[0].value;
 fireEvent.pointerLeave(screen.getByLabelText('one').parentElement!);await act(async()=>finish(grant.mediaUrl));expect(screen.queryByTestId('preview-video')).toBeNull();expect(api.clear).toHaveBeenCalledWith(grant.mediaUrl);
});
it('rejects a grant for another scope before exchanging cookies',async()=>{
 const {api}=setup();api.grant.mockResolvedValueOnce({mediaUrl:`https://media.alive.org.tw/videos/one/packages/${pkg}/sessions/wrong/master.m3u8`,packageId:pkg,expiresAt:new Date(Date.now()+3600000).toISOString()} as MemberRecordingPlayback);await hover();expect(api.exchange).not.toHaveBeenCalled();expect(screen.queryByTestId('preview-video')).toBeNull();expect(screen.getByLabelText('one')).toBeInTheDocument();
});
it('renews the same private scope without creating a second player',async()=>{
 const {api}=setup();await hover();await act(()=>vi.advanceTimersByTimeAsync(2880000));expect(api.grant).toHaveBeenCalledTimes(2);expect(api.grant.mock.calls[1][1]).toBe(api.grant.mock.calls[0][1]);expect(screen.getAllByTestId('preview-video')).toHaveLength(1);
});
it('uses the public live origin and the shared safe-edge player without watch telemetry',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const recording={id,captureId:pkg,title:'Live',liveState:'live',progress:{mediaEndSeconds:600,lastSequence:59}};
 const api={watch:vi.fn().mockResolvedValue({view:'live',live:recording,mediaStartSeconds:90}),liveGrant:vi.fn(async(_id:string,_capture:string,scope:string)=>({recordingId:id,captureId:pkg,playbackScopeId:scope,mediaUrl:`https://media.alive.org.tw/videos/${id}/captures/${pkg}/sessions/${scope}/master.m3u8`,issuedAt:new Date().toISOString(),serverNow:new Date().toISOString(),expiresAt:new Date(Date.now()+300000).toISOString(),captureExpiresAt:new Date(Date.now()+86400000).toISOString(),liveState:'live',progress:recording.progress,watermarkCode:'live-trace'})),exchangeLive:vi.fn(async(grant:{mediaUrl:string})=>grant.mediaUrl),clearLive:vi.fn().mockResolvedValue(undefined),heartbeat:vi.fn()};
 const {unmount}=render(<ThumbnailPreview api={api as unknown as ReturnType<typeof createMemberVideoApi>} recording={recording as import('@hallelujahhomechurch/hhc-web-client').MemberLiveRecording} labels={labels} enabled activeId={id} onActive={vi.fn()}><span>Cover</span></ThumbnailPreview>);
 await act(async()=>{});expect(player.mock.calls.at(-1)?.[0]).toMatchObject({playbackMode:'live',initialQuality:'480p',muted:true,controls:false,live:{verifiedEnd:510,canFollow:true},watermark:'live-trace'});expect(player.mock.calls.at(-1)?.[0].resume).toBeUndefined();expect(api.heartbeat).not.toHaveBeenCalled();unmount();await act(async()=>{});expect(api.clearLive).toHaveBeenCalledTimes(1);
});
