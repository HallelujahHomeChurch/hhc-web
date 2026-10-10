import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ComponentProps,RefObject} from 'react';
import {LiveRecordingPlayer,englishLiveLabels} from './LiveRecordingPlayer';
const session=vi.hoisted(()=>({playback:{url:'same-live-url',grant:{liveState:'ended',serverNow:'2026-10-09T05:30:00Z',stopAcceptedAt:null as string|null,watermarkCode:'trace',replayUntil:'2026-10-07T12:00:00Z',progress:{mediaEndSeconds:5400}}},pending:false,error:false,closed:false,bookmark:{current:{time:60,paused:true,rate:1.5,quality:'720p',intent:'dvr'}},remember:vi.fn(),start:vi.fn().mockResolvedValue(undefined)}));
vi.mock('./useLivePlayback',()=>({useLivePlayback:()=>session}));
vi.mock('./HlsPlayer',()=>({HlsPlayer:({live,onBookmark,videoRef}:{live:{label:string;canFollow:boolean};onBookmark:(value:unknown)=>void;videoRef:RefObject<HTMLVideoElement|null>})=><div data-testid="player" data-can-follow={String(live.canFollow)}>{live.label}<video ref={videoRef}/><button onClick={()=>onBookmark({time:1430,paused:false,rate:1,quality:'auto',intent:'followLive'})}>Advance playback</button></div>}));
afterEach(()=>{cleanup();session.playback.grant.liveState='ended';session.error=false;vi.useRealTimers();vi.restoreAllMocks();});
it('keeps an ended event mounted until an explicit VOD handoff with the same bookmark',async()=>{
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'live',progress:{mediaEndSeconds:5400}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en',onVod:vi.fn().mockResolvedValue(true)} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 render(<LiveRecordingPlayer {...props}/>);
 expect(screen.getByTestId('player')).toHaveTextContent(englishLiveLabels.ended);expect(screen.getByText(/Replay available until/)).toBeVisible();expect(props.onVod).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:englishLiveLabels.watchRecording}));
 expect(props.onVod).toHaveBeenCalledWith(session.bookmark.current);
});
it('expands the live description without replacing the player and omits empty text',()=>{
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',description:'<b>Plain text</b>\nSecond line',liveState:'live',progress:{mediaEndSeconds:5400}},labels:{description:'Video description',play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 const view=render(<LiveRecordingPlayer {...props}/>),player=screen.getByTestId('player');
 const summary=screen.getByText('Video description',{selector:'summary'}),details=summary.closest('details')!;
 expect(details.open).toBe(false);
 fireEvent.click(summary);expect(details.open).toBe(true);
 const text=screen.getByText(/<b>Plain text/);expect(text).toBeVisible();expect(text.textContent).toBe(props.recording.description);expect(text).toHaveClass('whitespace-pre-wrap');expect(view.container.querySelector('b')).toBeNull();
 expect(screen.getByTestId('player')).toBe(player);
 fireEvent.click(summary);expect(details.open).toBe(false);expect(screen.getByTestId('player')).toBe(player);
 view.rerender(<LiveRecordingPlayer {...props} recording={{...props.recording,description:''}}/>);
 expect(view.container.querySelector('details')).toBeNull();expect(screen.getByTestId('player')).toBe(player);
});

it('keeps recovering source state out of viewer copy while keeping actual playback errors visible',()=>{
 session.playback.grant.liveState='recovering';
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'recovering',progress:{mediaEndSeconds:5400}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 const view=render(<LiveRecordingPlayer {...props}/>);
 expect(screen.queryAllByText(englishLiveLabels.recovering)).toHaveLength(0);
 expect(screen.getByTestId('player')).toHaveTextContent('Live');
 session.error=true;view.rerender(<LiveRecordingPlayer {...props}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('Error');
});

it('shows the actual-position estimated delay instead of a fixed one-to-two-minute claim',()=>{
 session.playback.grant.liveState='live';vi.spyOn(performance,'now').mockReturnValue(1000);
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),createdAt:'2026-10-09T05:00:00Z',title:'Gathering',liveState:'live',progress:{mediaEndSeconds:1680}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 render(<LiveRecordingPlayer {...props}/>);
 expect(screen.queryByText(/1–2 minutes/)).not.toBeInTheDocument();
 vi.mocked(performance.now).mockReturnValue(11000);fireEvent.click(screen.getByRole('button',{name:'Advance playback'}));
 expect(screen.getByRole('status')).toHaveTextContent('Live · estimated delay 380 seconds');
});

it('keeps delay current while playback is paused or stalled',()=>{
 vi.useFakeTimers();session.playback.grant.liveState='live';vi.spyOn(performance,'now').mockReturnValue(1000);
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),createdAt:'2026-10-09T05:00:00Z',title:'Gathering',liveState:'live',progress:{mediaEndSeconds:1680}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 const view=render(<LiveRecordingPlayer {...props}/>),video=view.container.querySelector('video')!;
 Object.defineProperty(video,'readyState',{configurable:true,value:2});video.currentTime=1430;
 fireEvent.click(screen.getByRole('button',{name:'Advance playback'}));expect(screen.getByRole('status')).toHaveTextContent('370 seconds');
 vi.mocked(performance.now).mockReturnValue(61000);act(()=>vi.advanceTimersByTime(1000));
 expect(screen.getByRole('status')).toHaveTextContent('430 seconds');
});

it('uses the public media origin for position delay and bookmarks',()=>{
 session.playback.grant.liveState='live';vi.spyOn(performance,'now').mockReturnValue(1000);
 const props={mediaOriginSeconds:240,api:{},recording:{id:'r',captureId:'a'.repeat(32),createdAt:'2026-10-09T05:00:00Z',title:'Gathering',liveState:'live',progress:{mediaEndSeconds:1680}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 render(<LiveRecordingPlayer {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Advance playback'}));
 expect(screen.getByRole('status')).toHaveTextContent('130 seconds');
 expect(session.remember).toHaveBeenLastCalledWith(expect.objectContaining({time:1430,mediaOriginSeconds:240}));
});

 it('follows the safe verified edge while the source is recovering, but not after it ends',()=>{
 session.playback.grant.liveState='recovering';
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'recovering',progress:{mediaEndSeconds:1381.38}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 const view=render(<LiveRecordingPlayer {...props}/>);
 expect(screen.getByTestId('player')).toHaveAttribute('data-can-follow','true');
 session.playback.grant.liveState='ended';view.rerender(<LiveRecordingPlayer {...props}/>);
 expect(screen.getByTestId('player')).toHaveAttribute('data-can-follow','false');
});
