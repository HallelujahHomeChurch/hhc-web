import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ComponentProps} from 'react';
import {LiveRecordingPlayer,englishLiveLabels} from './LiveRecordingPlayer';
const session=vi.hoisted(()=>({playback:{url:'same-live-url',grant:{liveState:'ended',watermarkCode:'trace',replayUntil:'2026-10-07T12:00:00Z',progress:{mediaEndSeconds:5400}}},pending:false,error:false,closed:false,bookmark:{current:{time:60,paused:true,rate:1.5,quality:'720p',intent:'dvr'}},remember:vi.fn(),start:vi.fn().mockResolvedValue(undefined)}));
vi.mock('./useLivePlayback',()=>({useLivePlayback:()=>session}));
vi.mock('./HlsPlayer',()=>({HlsPlayer:({live}:{live:{label:string}})=><div data-testid="player">{live.label}</div>}));
afterEach(cleanup);
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
