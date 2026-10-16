vi.mock('./VideoInteractions',()=>({VideoInteractions:({children}:{children:import('react').ReactNode})=><>{children}</>}));
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ComponentProps,RefObject} from 'react';
import {LiveRecordingPlayer,englishLiveLabels} from './LiveRecordingPlayer';
const session=vi.hoisted(()=>({playback:{url:'same-live-url',grant:{liveState:'ended',serverNow:'2026-10-09T05:30:00Z',stopAcceptedAt:null as string|null,watermarkCode:'trace',replayUntil:'2026-10-07T12:00:00Z',progress:{mediaEndSeconds:5400}}},pending:false,error:false,closed:false,expired:false,bookmark:{current:{time:60,paused:true,rate:1.5,quality:'720p',intent:'dvr'}},remember:vi.fn(),start:vi.fn().mockResolvedValue(undefined)}));
vi.mock('./useLivePlayback',()=>({useLivePlayback:()=>session}));
vi.mock('./HlsPlayer',()=>({HlsPlayer:({live,onBookmark,videoRef}:{live:{label:string;canFollow:boolean};onBookmark:(value:unknown)=>void;videoRef:RefObject<HTMLVideoElement|null>})=><div data-testid="player" data-can-follow={String(live.canFollow)}>{live.label}<video ref={videoRef}/><button onClick={()=>onBookmark({time:1430,paused:false,rate:1,quality:'auto',intent:'followLive'})}>Advance playback</button></div>}));
afterEach(()=>{cleanup();session.playback.grant.liveState='ended';session.error=false;session.closed=false;session.expired=false;vi.useRealTimers();vi.restoreAllMocks();});
it('keeps an ended event mounted until an explicit VOD handoff with the same bookmark',async()=>{
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'live',progress:{mediaEndSeconds:5400}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en',onVod:vi.fn().mockResolvedValue(true)} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 render(<LiveRecordingPlayer {...props}/>);
 expect(screen.getByTestId('player')).toHaveTextContent(englishLiveLabels.ended);expect(screen.getByText(/Replay available until/)).toBeVisible();expect(props.onVod).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:englishLiveLabels.watchRecording}));
 expect(props.onVod).toHaveBeenCalledWith(session.bookmark.current);
});
it('retries a failed VOD handoff without rebuilding the ended replay',async()=>{
 const onVod=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'ended',progress:{mediaEndSeconds:5400}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en',onVod} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 session.start.mockClear();
 render(<LiveRecordingPlayer {...props}/>);
 const player=screen.getByTestId('player');
 fireEvent.click(screen.getByRole('button',{name:englishLiveLabels.watchRecording}));
 fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(onVod).toHaveBeenCalledTimes(2));
 expect(onVod).toHaveBeenLastCalledWith(session.bookmark.current);
 expect(session.start).not.toHaveBeenCalled();
 expect(screen.getByTestId('player')).toBe(player);
 expect(screen.queryByRole('alert')).toBeNull();
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

it('only calls a closed session expired when its authoritative deadline was reached',()=>{
 session.closed=true;
 const props={api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'live',progress:{mediaEndSeconds:5400}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 const view=render(<LiveRecordingPlayer {...props}/>);
 expect(screen.queryAllByText(englishLiveLabels.expired)).toHaveLength(0);
 expect(screen.getAllByText(englishLiveLabels.failed)).toHaveLength(2);
 session.expired=true;view.rerender(<LiveRecordingPlayer {...props}/>);
 expect(screen.getAllByText(englishLiveLabels.expired)).toHaveLength(2);
});

it.each(['pending','zero','capture','recording','remount'] as const)('scopes the last known projection origin across %s',change=>{
 const props={mediaOriginSeconds:300,api:{},recording:{id:'r',captureId:'a'.repeat(32),title:'Gathering',liveState:'ended',progress:{mediaEndSeconds:1800}},labels:{play:'Play',retry:'Retry',playError:'Error',loading:'Loading'},liveLabels:englishLiveLabels,locale:'en'} as unknown as ComponentProps<typeof LiveRecordingPlayer>;
 const view=render(<LiveRecordingPlayer {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Advance playback'}));
 if(change==='zero')view.rerender(<LiveRecordingPlayer {...props} mediaOriginSeconds={0}/>);
 const recording={...props.recording,...(change==='capture'?{captureId:'b'.repeat(32)}:change==='recording'?{id:'other'}:{})};
 if(change==='remount'){view.unmount();render(<LiveRecordingPlayer {...props} mediaOriginSeconds={null}/>);}
 else view.rerender(<LiveRecordingPlayer {...props} recording={recording} mediaOriginSeconds={null}/>);
 fireEvent.click(screen.getByRole('button',{name:'Advance playback'}));
 expect(session.remember).toHaveBeenLastCalledWith(expect.objectContaining({mediaOriginSeconds:change==='pending'?300:0}));
});
