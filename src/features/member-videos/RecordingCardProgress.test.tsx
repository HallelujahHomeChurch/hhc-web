import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useEffect,useRef} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import type {MemberRecordingCard} from '@hallelujahhomechurch/hhc-web-client';
import {createCardProgressStore} from './card-progress';
import {RecordingCardProgress} from './RecordingCardProgress';
import {usePlaybackProgress} from './usePlaybackProgress';
const recording:MemberRecordingCard={id:'r1',title:'Fixture',durationSeconds:120,uploadedAt:null,expiresAt:null,featured:false,hidden:false,status:'published',version:1};
const context=vi.hoisted(()=>({cardProgress:null as unknown as ReturnType<typeof createCardProgressStore>,registerPlayback:vi.fn(()=>()=>{})}));
vi.mock('./PlaybackProvider',()=>({usePersistentPlayback:()=>context}));
beforeEach(()=>{context.cardProgress=createCardProgressStore();});
it('updates only a matching owned VOD card and falls back after a takeover denial while media keeps playing',async()=>{
 const version='vod:package:1',api={progress:vi.fn().mockResolvedValue({mediaVersion:version,claimToken:'fixture',progress:null}),claimProgress:vi.fn().mockResolvedValue({generation:'A',mediaVersion:version,positionSeconds:60,sequence:0}),saveProgress:vi.fn().mockRejectedValue({status:409})};
 function Media(){const surface=useRef<HTMLDivElement>(null),media=useRef<HTMLVideoElement>(null);const prepare=usePlaybackProgress(api,'r1','vod:package',surface,media,true);useEffect(()=>{void prepare('resume');},[prepare]);return <div ref={surface}><video ref={media} aria-label="Owned video"/></div>;}
 const item=(id:string,title:string,mediaVersion:string)=>({...recording,id,title,playbackProgress:{mediaVersion,positionSeconds:30,completed:false}});
 render(<><Media/><RecordingCardProgress item={item('r1','One',version)} label="Progress"/><RecordingCardProgress item={item('r2','Other',version)} label="Progress"/><RecordingCardProgress item={item('r1','New range','vod:package:2')} label="Progress"/></>);
 const bar=screen.getByRole('progressbar',{name:'One — Progress'}),video=screen.getByLabelText('Owned video') as HTMLVideoElement;
 Object.defineProperties(video,{paused:{configurable:true,value:false},readyState:{configurable:true,value:4}});video.currentTime=60;
 await act(async()=>{});expect(bar).toHaveAttribute('value','25');expect(api.claimProgress).not.toHaveBeenCalled();
 fireEvent.playing(video);await waitFor(()=>expect(bar).toHaveAttribute('value','50'));
 video.currentTime=90;fireEvent.timeUpdate(video);expect(bar).toHaveAttribute('value','75');
 expect(screen.getByRole('progressbar',{name:'Other — Progress'})).toHaveAttribute('value','25');expect(screen.getByRole('progressbar',{name:'New range — Progress'})).toHaveAttribute('value','25');
 video.currentTime=100;fireEvent.seeked(video);await waitFor(()=>expect(bar).toHaveAttribute('value','25'));expect(video.paused).toBe(false);expect(api.progress).toHaveBeenCalledOnce();expect(api.claimProgress).toHaveBeenCalledOnce();
});


it.each([undefined,null])('uses the independent authority version for a first watch with %s history',async(history)=>{
 const version='vod:package:7',api={progress:vi.fn().mockResolvedValue({mediaVersion:version,claimToken:'fixture',progress:null}),claimProgress:vi.fn().mockResolvedValue({generation:'A',mediaVersion:version,positionSeconds:0,sequence:0}),saveProgress:vi.fn().mockResolvedValue({accepted:true,sequence:1})};
 function Media(){const surface=useRef<HTMLDivElement>(null),media=useRef<HTMLVideoElement>(null);const prepare=usePlaybackProgress(api,'r1','vod:package',surface,media,true);useEffect(()=>{void prepare('resume');},[prepare]);return <div ref={surface}><video ref={media} aria-label="First watch"/></div>;}
 const item={...recording,title:'First',playbackMediaVersion:version,playbackProgress:history};
 const unknown={...item,id:'r1',title:'Unknown',playbackMediaVersion:null};
 const changed={...item,title:'New range',playbackMediaVersion:'vod:package:8'};
 render(<><Media/><RecordingCardProgress item={item} label="Progress"/><RecordingCardProgress item={unknown} label="Progress"/><RecordingCardProgress item={changed} label="Progress"/></>);
 const video=screen.getByLabelText('First watch') as HTMLVideoElement;
 Object.defineProperties(video,{paused:{configurable:true,value:false},readyState:{configurable:true,value:4}});video.currentTime=24;
 await act(async()=>{});expect(screen.queryByRole('progressbar')).toBeNull();expect(api.claimProgress).not.toHaveBeenCalled();
 fireEvent.playing(video);await waitFor(()=>expect(screen.getByRole('progressbar',{name:'First — Progress'})).toHaveAttribute('value','20'));
 video.currentTime=60;fireEvent.timeUpdate(video);expect(screen.getByRole('progressbar',{name:'First — Progress'})).toHaveAttribute('value','50');
 expect(screen.queryByRole('progressbar',{name:'Unknown — Progress'})).toBeNull();expect(screen.queryByRole('progressbar',{name:'New range — Progress'})).toBeNull();
 expect(api.progress).toHaveBeenCalledOnce();expect(api.claimProgress).toHaveBeenCalledOnce();
});

it('does not reuse saved history when an explicit authority version changed or was withdrawn',()=>{
 const base={...recording,title:'Old',playbackProgress:{mediaVersion:'vod:package:7',positionSeconds:30,completed:false}};
 const changed={...base,playbackMediaVersion:'vod:package:8'},withdrawn={...base,playbackMediaVersion:null};
 render(<><RecordingCardProgress item={changed} label="Progress"/><RecordingCardProgress item={withdrawn} label="Progress"/></>);
 expect(screen.queryByRole('progressbar')).toBeNull();
});
