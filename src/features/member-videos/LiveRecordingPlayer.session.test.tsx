import {StrictMode,type ComponentProps} from 'react';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {HhcWebApiError,type MemberLivePlayback} from '@hallelujahhomechurch/hhc-web-client';
import {LiveRecordingPlayer,englishLiveLabels} from './LiveRecordingPlayer';
vi.mock('./HlsPlayer',()=>({HlsPlayer:()=> <div data-testid="live-video"/>}));
const id='11111111-1111-4111-8111-111111111111',capture='a'.repeat(32);
function setup(state='live'){
 const api={liveGrant:vi.fn(async(_id:string,_capture:string,scope:string):Promise<MemberLivePlayback>=>({recordingId:id,captureId:capture,playbackScopeId:scope,mediaUrl:`https://media.alive.org.tw/videos/${id}/captures/${capture}/sessions/${scope}/master.m3u8`,exchangeCredential:'test',serverNow:new Date().toISOString(),issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+300000).toISOString(),captureExpiresAt:new Date(Date.now()+86400000).toISOString(),replayUntil:null,stopAcceptedAt:null,terminalReason:null,liveState:'live',progress:{revision:3,firstSequence:0,lastSequence:2,mediaEndSeconds:90,lastAdvancedAt:null,endedAt:null,ended:false},watermarkCode:'trace'})),exchangeLive:vi.fn(async(g:MemberLivePlayback)=>g.mediaUrl),clearLive:vi.fn().mockResolvedValue(undefined)};
 const props={api,recording:{id,captureId:capture,title:'Live gathering',liveState:state,progress:{lastSequence:state==='starting'?0:2,mediaEndSeconds:90}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 return {api,props};
}
afterEach(()=>{cleanup();vi.useRealTimers();});
it('automatically prepares live entry under StrictMode without duplicate exchange or a primary play gate',async()=>{
 const {api,props}=setup();const view=render(<StrictMode><LiveRecordingPlayer {...props}/></StrictMode>);
 expect(screen.queryByRole('button',{name:'Play'})).not.toBeInTheDocument();
 await screen.findByTestId('live-video');expect(api.exchangeLive).toHaveBeenCalledTimes(1);
 const calls=api.liveGrant.mock.calls.length;
 view.rerender(<StrictMode><LiveRecordingPlayer {...props} recording={{...props.recording,progress:{...props.recording.progress,mediaEndSeconds:180}}}/></StrictMode>);
 expect(api.liveGrant).toHaveBeenCalledTimes(calls);
});
it.each(['failed','expired','aborted'])('does not prepare a terminal %s entry',async state=>{
 const {api,props}=setup(state);render(<LiveRecordingPlayer {...props}/>);await act(async()=>{});expect(api.liveGrant).not.toHaveBeenCalled();
});
it('prepares once when a starting capture becomes ready after bounded retries are exhausted',async()=>{
 vi.useFakeTimers();const {api,props}=setup('starting'),grant=api.liveGrant.getMockImplementation()!;
 api.liveGrant.mockRejectedValue(new HhcWebApiError(409,'capture_conflict','Not ready'));
 const view=render(<LiveRecordingPlayer {...props}/>);await act(()=>vi.advanceTimersByTimeAsync(240000));
 expect(api.liveGrant.mock.calls.length).toBeGreaterThan(1);expect(api.liveGrant.mock.calls.length).toBeLessThan(8);
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 const calls=api.liveGrant.mock.calls.length;await act(()=>vi.advanceTimersByTimeAsync(120000));expect(api.liveGrant).toHaveBeenCalledTimes(calls);
 api.liveGrant.mockImplementation(grant);
 view.rerender(<LiveRecordingPlayer {...props} recording={{...props.recording,liveState:'live',progress:{...props.recording.progress,lastSequence:2}}}/>);
 await act(async()=>{});expect(screen.getByTestId('live-video')).toBeVisible();expect(api.liveGrant).toHaveBeenCalledTimes(calls+1);
});
it('keeps a non-readiness conflict visible for explicit retry',async()=>{
 const {api,props}=setup();api.liveGrant.mockRejectedValue(new HhcWebApiError(409,'capture_conflict','Conflict'));
 render(<LiveRecordingPlayer {...props}/>);expect(await screen.findByRole('alert')).toHaveTextContent('Error');
});
it('a late exchange cleanup cannot clear the newly active same-scope cookie',async()=>{
 const {api,props}=setup();let release!:()=>void,cookie=false;
 api.exchangeLive.mockImplementationOnce(async grant=>{await new Promise<void>(resolve=>{release=resolve;});cookie=true;return grant.mediaUrl;});
 api.exchangeLive.mockImplementation(async grant=>{cookie=true;return grant.mediaUrl;});api.clearLive.mockImplementation(async()=>{cookie=false;});
 const view=render(<LiveRecordingPlayer {...props}/>);await waitFor(()=>expect(api.exchangeLive).toHaveBeenCalledTimes(1));
 view.rerender(<LiveRecordingPlayer {...props} api={{...api} as unknown as ComponentProps<typeof LiveRecordingPlayer>['api']}/>);
 await act(async()=>{release();});await screen.findByTestId('live-video');expect(cookie).toBe(true);
 view.unmount();await act(async()=>{});expect(cookie).toBe(false);
});
