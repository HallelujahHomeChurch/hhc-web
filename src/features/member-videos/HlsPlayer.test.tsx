import {createRef} from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {HlsPlayer} from './HlsPlayer';

const engine=vi.hoisted(()=>({supported:true,manifestReady:true,instances:[] as {nextLevel:number;listeners:Record<string,(...args:unknown[])=>void>;loadSource:ReturnType<typeof vi.fn>;destroy:ReturnType<typeof vi.fn>;config:{xhrSetup:(xhr:XMLHttpRequest,url:string)=>void}}[]}));
const url='https://media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/master.m3u8';
vi.mock('hls.js',()=>({default:class {
  static isSupported(){return engine.supported;}
  static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};
  nextLevel=-1;
  listeners:Record<string,(...args:unknown[])=>void>={};
  levels=[{url:[url.replace('master.m3u8','720p/index.m3u8')]},{url:[url.replace('master.m3u8','1080p/index.m3u8')]},{url:[url.replace('master.m3u8','480p/index.m3u8')]}];
  loadSource=vi.fn();destroy=vi.fn();
  constructor(public config:{xhrSetup:(xhr:XMLHttpRequest,url:string)=>void}) {engine.instances.push(this);}
  on(event:string,callback:(...args:unknown[])=>void){this.listeners[event]=callback;if(event==='manifest'&&engine.manifestReady)queueMicrotask(callback);}
  attachMedia(){}
}}));
const labels={quality:'Quality',auto:'Auto',play:'Play',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Playback position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Could not exit fullscreen. Retry.',playbackSpeed:'Speed',theaterMode:'Theater mode',exitTheaterMode:'Exit theater mode',tapToPlay:'Tap to start playback',settings:'Settings',togglePlayback:'Play or pause',privateCopy:'HHC members only',buffering:'Loading video'};
const props=()=>({playbackUrl:url,availableQualities:['720p','1080p'] as ('720p'|'1080p')[],watermark:'TRACE123',title:'Sunday',labels,videoRef:createRef<HTMLVideoElement>(),onPlayingChange:vi.fn(),onError:vi.fn()});

it('exposes 480p only when provided and keeps its requests inside the authenticated session',async()=>{
  const p=props();render(<HlsPlayer {...p} availableQualities={['480p','720p','1080p']}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  expect(screen.getByRole('option',{name:'480p'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'480p'}});
  expect(engine.instances[0].nextLevel).toBe(2);
  const xhr=new XMLHttpRequest();
  engine.instances[0].config.xhrSetup(xhr,url.replace('master.m3u8','480p/seg-000000.m4s'));
  expect(xhr.withCredentials).toBe(true);
});
beforeEach(()=>{
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(600);
  vi.spyOn(HTMLVideoElement.prototype,'videoWidth','get').mockReturnValue(1920);
  vi.spyOn(HTMLVideoElement.prototype,'videoHeight','get').mockReturnValue(1080);
  engine.supported=true;engine.manifestReady=true;engine.instances=[];
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

it.each([false,true])('ends loading on fatal media failure after manifest=%s', async(manifestReady)=>{
  engine.manifestReady=manifestReady;
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  if(manifestReady)fireEvent.waiting(p.videoRef.current!);
  expect(screen.getByRole('status')).toHaveTextContent('Loading video');
  act(()=>engine.instances[0].listeners.error('error',{fatal:true}));
  expect(p.onError).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps loading through startup, then follows buffering and pause events',async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.getByRole('status')).toHaveTextContent('Loading video');
  fireEvent.canPlay(p.videoRef.current!);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.waiting(p.videoRef.current!);
  expect(screen.getByRole('status')).toBeInTheDocument();
  fireEvent.pause(p.videoRef.current!);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps K working after toolbar focus but leaves button Space activation native', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  const mute=screen.getByRole('button',{name:'Mute'});
  mute.focus();
  vi.mocked(video.play).mockClear();
  fireEvent.keyDown(mute,{key:'k'});
  expect(video.play).toHaveBeenCalledOnce();
  fireEvent.keyDown(mute,{key:' '});
  expect(video.play).toHaveBeenCalledOnce();
});
it('switches MSE quality without seeking or reloading, and returns to automatic adaptation',async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;video.currentTime=97;
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'1080p'}});
  expect(engine.instances[0].nextLevel).toBe(1);expect(video.currentTime).toBe(97);
  fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'auto'}});
  expect(engine.instances[0].nextLevel).toBe(-1);
  expect(engine.instances[0].loadSource).toHaveBeenCalledTimes(1);
});
it('does not rebuild or reset the engine when the watermark or cover changes',async()=>{
  const p=props();const view=render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  p.videoRef.current!.currentTime=150;
  view.rerender(<HlsPlayer {...p} watermark="RENEWED" poster="blob:private-cover"/>);
  expect(engine.instances).toHaveLength(1);expect(engine.instances[0].destroy).not.toHaveBeenCalled();
  expect(p.videoRef.current!.currentTime).toBe(150);
  expect(p.videoRef.current!).toHaveAttribute('poster','blob:private-cover');
  expect(screen.getAllByText('RENEWED')).toHaveLength(6);
  expect(screen.getAllByText('RENEWED')[0].parentElement).toHaveAttribute('aria-hidden','true');
});
it('repositions the same watermark overlay for resize and portrait media without reloading',async()=>{
  const p=props();render(<HlsPlayer {...p} watermark="01234ABCDE"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.getAllByText('01234-ABCDE')).toHaveLength(6);
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(700);
  vi.spyOn(HTMLVideoElement.prototype,'videoWidth','get').mockReturnValue(900);
  vi.spyOn(HTMLVideoElement.prototype,'videoHeight','get').mockReturnValue(1600);
  fireEvent(p.videoRef.current!,new Event('resize'));
  const marks=screen.getAllByText('01234-ABCDE');
  expect(marks).toHaveLength(4);
  expect(marks[0].parentElement).toHaveStyle({left:'0px',width:'390px'});
  expect(engine.instances).toHaveLength(1);expect(engine.instances[0].loadSource).toHaveBeenCalledOnce();
});
it('omits unavailable quality and sends only media cookies on canonical package requests',async()=>{
  const p=props();render(<HlsPlayer {...p} availableQualities={['720p']}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.queryByRole('option',{name:'1080p'})).not.toBeInTheDocument();
  const xhr={withCredentials:false} as XMLHttpRequest;
  engine.instances[0].config.xhrSetup(xhr,url.replace('master.m3u8','720p/seg-000000.m4s'));
  expect(xhr.withCredentials).toBe(true);
  expect(()=>engine.instances[0].config.xhrSetup(xhr,'https://evil.example/media')).toThrow();
});
it('preserves native playback position and paused state across rendition and Auto changes',async()=>{
  engine.supported=false;
  vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
  const p=props();render(<HlsPlayer {...p}/>);
  const video=p.videoRef.current!;
  await waitFor(()=>expect(video.src).toBe(url));
  video.currentTime=81;
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'720p'}});
  expect(video.src).toBe(url.replace('master.m3u8','720p/index.m3u8'));
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(81);
  const calls=vi.mocked(video.play).mock.calls.length;
  fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'auto'}});
  fireEvent.loadedMetadata(video);
  expect(video.src).toBe(url);expect(video.currentTime).toBe(81);
  expect(video.play).toHaveBeenCalledTimes(calls);
});

it('toggles with Space and the video surface without hijacking form controls', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  vi.mocked(video.play).mockClear();
  const region=screen.getByRole('region');
  fireEvent.keyDown(region,{key:' '});
  expect(video.play).toHaveBeenCalledOnce();
  Object.defineProperty(video,'paused',{configurable:true,value:false});
  fireEvent.play(video);
  fireEvent.click(screen.getByRole('button',{name:'Play or pause'}));
  expect(video.pause).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.keyDown(screen.getByRole('combobox',{name:'Speed'}),{key:' '});
  fireEvent.keyDown(screen.getByRole('slider',{name:'Playback position'}),{key:' '});
  expect(video.pause).toHaveBeenCalledOnce();
  fireEvent.keyDown(region,{key:' ',repeat:true});
  expect(video.pause).toHaveBeenCalledOnce();
});

it('commits a pointer scrub on release and keeps keyboard seek responsive', async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
  try {
    const p=props();render(<HlsPlayer {...p}/>);
    await waitFor(()=>expect(engine.instances).toHaveLength(1));
    const video=p.videoRef.current!;
    Object.defineProperty(video,'duration',{configurable:true,value:600});
    video.currentTime=30; fireEvent.durationChange(video); fireEvent.timeUpdate(video);
    const seek=screen.getByRole('slider',{name:'Playback position'});
    fireEvent.pointerDown(seek);
    fireEvent.change(seek,{target:{value:'240'}});
    expect(video.currentTime).toBe(30);
    fireEvent.pointerUp(seek);
    expect(video.currentTime).toBe(240);
    fireEvent.keyDown(screen.getByRole('region'),{key:'ArrowRight'});
    expect(video.currentTime).toBe(245);
    fireEvent.keyDown(screen.getByRole('region'),{key:'j'});
    expect(video.currentTime).toBe(235);
  } finally {vi.unstubAllGlobals();}
});

it('restores audible volume from a zero-volume slider', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!; video.volume=0;fireEvent.volumeChange(video);
  fireEvent.click(screen.getByRole('button',{name:'Unmute'}));
  expect(video.volume).toBe(1);expect(video.muted).toBe(false);
});
it('fullscreens the container with watermark, not the native video element',async()=>{
  const request=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:request});
  try {
    const p=props();render(<HlsPlayer {...p}/>);
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Fullscreen'}));});
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.contexts[0]).toContainElement(screen.getAllByText('TRACE123')[0]);
    expect(p.videoRef.current).not.toHaveAttribute('controls');
  } finally {delete (HTMLElement.prototype as unknown as Record<string,unknown>).requestFullscreen;}
});

it('nativeFullscreenWithoutContainerAPI follows native events without reloading the video', async()=>{
  const p=props(); render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  const enter=vi.fn(()=>video.dispatchEvent(new Event('webkitbeginfullscreen')));
  const exit=vi.fn(()=>video.dispatchEvent(new Event('webkitendfullscreen')));
  Object.assign(video,{webkitSupportsFullscreen:true,webkitEnterFullscreen:enter,webkitExitFullscreen:exit});
  video.currentTime=81;video.playbackRate=1.5;
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  expect(enter).toHaveBeenCalledOnce();
  expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeInTheDocument();
  fireEvent(video,new Event('webkitendfullscreen'));
  expect(screen.getByRole('button',{name:'Fullscreen'})).toBeInTheDocument();
  expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(81);expect(video.playbackRate).toBe(1.5);
  expect(engine.instances[0].loadSource).toHaveBeenCalledOnce();
});

it('viewportRestoresFocusAndScroll and keeps the player mounted for five cycles', async()=>{
  const p=props();const view=render(<><button>Outside</button><HlsPlayer {...p}/></>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;video.currentTime=150;video.playbackRate=1.5;
  document.body.style.overflow='auto';
  const outside=screen.getByRole('button',{name:'Outside'});
  for(let i=0;i<5;i++) {
    Object.defineProperty(window,'scrollY',{value:640,writable:true,configurable:true});
    const button=screen.getByRole('button',{name:'Fullscreen'});button.focus();
    await act(async()=>fireEvent.click(button));
    expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
    expect(document.body.style.overflow).toBe('hidden');
    expect(outside).toHaveAttribute('inert');
    Object.defineProperty(window,'scrollY',{value:0,writable:true,configurable:true});
    fireEvent.keyDown(screen.getByRole('region'),{key:'Escape'});
    expect(window.scrollTo).toHaveBeenLastCalledWith(0,640);
    expect(document.body.style.overflow).toBe('auto');
    expect(outside).not.toHaveAttribute('inert');expect(button).toHaveFocus();
  }
  expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(150);expect(video.playbackRate).toBe(1.5);
  expect(engine.instances).toHaveLength(1);expect(engine.instances[0].loadSource).toHaveBeenCalledOnce();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  view.unmount();expect(document.body.style.overflow).toBe('auto');document.body.style.overflow='';
});

it('exitFailureDoesNotReenter or claim that native fullscreen ended', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  const video=p.videoRef.current!;
  const enter=vi.fn(()=>video.dispatchEvent(new Event('webkitbeginfullscreen')));
  Object.assign(video,{webkitEnterFullscreen:enter,webkitExitFullscreen:()=>{throw new Error('denied');}});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Exit fullscreen'})));
  expect(enter).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeInTheDocument();
  expect(screen.getByRole('region')).not.toHaveAttribute('data-fullscreen','viewport');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not exit fullscreen');
});

it('resynchronizes a native exit on foreground and does not steal settings Escape',async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  const video=p.videoRef.current!;
  Object.assign(video,{webkitDisplayingFullscreen:true,webkitEnterFullscreen:()=>video.dispatchEvent(new Event('webkitbeginfullscreen'))});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  Object.assign(video,{webkitDisplayingFullscreen:false});
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
  fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByRole('button',{name:'Fullscreen'})).toBeInTheDocument();
  Object.assign(video,{webkitSupportsFullscreen:false});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.keyDown(screen.getByRole('combobox',{name:'Speed'}),{key:'Escape'});
  expect(screen.queryByRole('combobox',{name:'Speed'})).not.toBeInTheDocument();
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
  fireEvent.keyDown(screen.getByRole('region'),{key:'Escape'});
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','inline');
});

it('falls back to viewport if fullscreen entry fails and retains an exit button', async()=>{
  const request=vi.fn().mockRejectedValue(new Error('denied'));
  Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:request});
  try {
    const p=props();render(<HlsPlayer {...p}/>);
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
    expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
    expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeInTheDocument();
  } finally {delete (HTMLElement.prototype as unknown as Record<string,unknown>).requestFullscreen;}
});

it('starts live behind the verified edge and preserves DVR until an explicit return',async()=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>5400}});
 Object.defineProperty(video,'duration',{configurable:true,value:Infinity});
 fireEvent.progress(video);
 expect(video.currentTime).toBe(5370);
 const seek=screen.getByRole('slider',{name:'Playback position'});
 expect(seek).toHaveAttribute('max','5400');
 expect(screen.queryByText(/\d+:\d+ \/ \d+:\d+/)).toBeNull();
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveTextContent('Live');
 Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.timeUpdate(video);fireEvent.play(video);
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveAttribute('data-live-edge','true');
 fireEvent.change(seek,{target:{value:'60'}});
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveAttribute('data-live-edge','false');
 fireEvent.progress(video);
 fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(60);
 fireEvent.click(screen.getByRole('button',{name:'Back to live'}));
 expect(video.currentTime).toBe(5370);
 expect(engine.instances[0].config).toMatchObject({backBufferLength:120,maxBufferLength:60,maxMaxBufferLength:120,liveMaxLatencyDuration:Infinity,maxLiveSyncPlaybackRate:1});
});

it('disables return when live stops and bounds DVR seeking to the available timeline',async()=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:false,label:'Live ended',backToLive:'Back to live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>3600,end:()=>5400}});
 fireEvent.progress(video);
 expect(screen.getByRole('button',{name:'Live ended'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Live ended'})).toHaveAttribute('data-live-edge','false');
 const slider=screen.getByRole('slider',{name:'Playback position'});
 expect(slider).toHaveAttribute('min','3600');
 video.currentTime=3601;fireEvent.timeUpdate(video);
 fireEvent.keyDown(screen.getByRole('region'),{key:'ArrowLeft'});
 expect(video.currentTime).toBe(3600);
});

it('restores a paused DVR bookmark without first-entry live seeking or autoplay',async()=>{
 const p=props();const remembered=vi.fn();
 const live={verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'};
 const {rerender}=render(<HlsPlayer {...p} playbackMode="live" live={live} resume={{time:60,paused:true,rate:1.5,quality:'720p',intent:'dvr'}} onBookmark={remembered}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>6300}});
 fireEvent.loadedMetadata(video);
 expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(video.play).not.toHaveBeenCalled();expect(engine.instances[0].nextLevel).toBe(0);
 rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:6300}} onBookmark={remembered}/>);
 fireEvent.progress(video);fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(60);expect(engine.instances).toHaveLength(1);
 expect(remembered).toHaveBeenLastCalledWith(expect.objectContaining({time:60,rate:1.5,intent:'dvr'}));
});
it('native live quality switching retains a paused DVR position and intent',async()=>{
 engine.supported=false;
 vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),remembered=vi.fn();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'}} onBookmark={remembered}/>);
 await waitFor(()=>expect(p.videoRef.current?.src).toBe(url));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>5400}});fireEvent.loadedMetadata(video);
 fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'60'}});fireEvent.pause(video);video.playbackRate=1.5;
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'1080p'}});
 fireEvent.loadedMetadata(video);fireEvent.progress(video);fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(remembered).toHaveBeenLastCalledWith(expect.objectContaining({intent:'dvr',quality:'1080p'}));
});
it('native live quality switching waits for later seekable progress before restoring DVR',async()=>{
 engine.supported=false;vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),remembered=vi.fn();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'}} onBookmark={remembered}/>);
 await waitFor(()=>expect(p.videoRef.current?.src).toBe(url));
 const video=p.videoRef.current!;let end=5400;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:end?1:0,start:()=>0,end:()=>end})});
 await act(async()=>{fireEvent.loadedMetadata(video);});
 fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'60'}});fireEvent.pause(video);video.playbackRate=1.5;
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'1080p'}});
 end=0;video.currentTime=0;fireEvent.loadedMetadata(video);
 expect(video.currentTime).toBe(0);
 // Another quality selection before seekable arrives must keep the original bookmark.
 fireEvent.change(screen.getByRole('combobox',{name:'Quality'}),{target:{value:'720p'}});
 end=5400;fireEvent.progress(video);
 expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(video.play).toHaveBeenCalledTimes(1);
 fireEvent(window,new Event('online'));
 expect(remembered).toHaveBeenLastCalledWith(expect.objectContaining({time:60,intent:'dvr',quality:'720p'}));
 video.currentTime=75;fireEvent.canPlay(video);fireEvent.progress(video);
 expect(video.currentTime).toBe(75);
});


function touchSurface() {
  vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
}
function touch(element:HTMLElement,type:string,x=300,y=100) {
  fireEvent(element,new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y}));
}
it('touch taps toggle controls without pausing; double taps seek and clamp at the video ends',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  Object.defineProperty(video,'paused',{configurable:true,value:false});
  Object.defineProperty(video,'duration',{configurable:true,value:100});
  fireEvent.play(video);fireEvent.canPlay(video);fireEvent.durationChange(video);
  const surface=screen.getByRole('button',{name:'Play or pause'});
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,width:600} as DOMRect);
  vi.useFakeTimers();
  touch(surface,'pointerdown');touch(surface,'pointerup');
  act(()=>vi.advanceTimersByTime(300));
  expect(video.pause).not.toHaveBeenCalled();
  expect(screen.getByRole('region')).toHaveAttribute('data-controls-visible','false');
  video.currentTime=95;
  touch(surface,'pointerdown',500);touch(surface,'pointerup',500);
  touch(surface,'pointerdown',500);touch(surface,'pointerup',500);
  expect(video.currentTime).toBe(100);
  act(()=>vi.advanceTimersByTime(1000));
  video.currentTime=5;
  touch(surface,'pointerdown',100);touch(surface,'pointerup',100);
  touch(surface,'pointerdown',100);touch(surface,'pointerup',100);
  expect(video.currentTime).toBe(0);expect(video.pause).not.toHaveBeenCalled();
});
it('restores the original speed after a held touch is released or cancelled',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;Object.defineProperty(video,'paused',{configurable:true,value:false});video.playbackRate=1.5;fireEvent.play(video);
  const surface=screen.getByRole('button',{name:'Play or pause'});vi.useFakeTimers();
  touch(surface,'pointerdown');act(()=>vi.advanceTimersByTime(500));expect(video.playbackRate).toBe(2);
  touch(surface,'pointerup');expect(video.playbackRate).toBe(1.5);
  touch(surface,'pointerdown');act(()=>vi.advanceTimersByTime(500));touch(surface,'pointercancel');expect(video.playbackRate).toBe(1.5);
});
it('swipes into and out of a full viewport while retaining the same video and watermark',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;video.currentTime=81;
  const enter=vi.fn();Object.assign(video,{webkitEnterFullscreen:enter,webkitSupportsFullscreen:true});
  const surface=screen.getByRole('button',{name:'Play or pause'});
  await act(async()=>{touch(surface,'pointerdown',300,180);touch(surface,'pointermove',300,50);touch(surface,'pointerup',300,50);});
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
  expect(enter).not.toHaveBeenCalled();
  await act(async()=>{touch(surface,'pointerdown',300,50);touch(surface,'pointermove',300,180);touch(surface,'pointerup',300,180);});
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','inline');expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(81);
});

it('offers a central play control when audible autoplay is blocked, without claiming a media failure',async()=>{
  touchSurface();vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Autoplay blocked','NotAllowedError'));
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));fireEvent.canPlay(p.videoRef.current!);
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(p.videoRef.current!.play).toHaveBeenCalledTimes(2);expect(p.onError).not.toHaveBeenCalled();
});

it('touch skip controls link to adjacent recordings and omit missing neighbors',async()=>{
  touchSurface();const p=props();const view=render(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.getByRole('link',{name:'Previous video'})).toHaveAttribute('href','/en/member-videos/first');
  expect(screen.getByRole('link',{name:'Next video'})).toHaveAttribute('href','/en/member-videos/third');
  view.rerender(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} nextHref="/en/member-videos/third"/>);
  expect(screen.queryByRole('link',{name:'Previous video'})).toBeNull();
});

it('includes adjacent video links in the viewport fullscreen keyboard focus loop',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));fireEvent.canPlay(p.videoRef.current!);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  const previous=screen.getByRole('link',{name:'Previous video'}),play=screen.getByRole('button',{name:'Play'});
  play.focus();expect(fireEvent.keyDown(play,{key:'Tab',shiftKey:true})).toBe(true);
  previous.focus();fireEvent.keyDown(previous,{key:'Tab',shiftKey:true});
  expect(screen.getAllByRole('button',{name:'Exit fullscreen'}).at(-1)).toHaveFocus();
});


it.each([false,true])('exposes play after policy rejection before canplay on native=%s without muting',async(native)=>{
  touchSurface();engine.supported=!native;
  if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Requires gesture','NotAllowedError'));
  const p=props();render(<HlsPlayer {...p}/>);const video=p.videoRef.current!;
  if(native){await waitFor(()=>expect(video.src).toBe(url));fireEvent.loadedMetadata(video);}
  expect(await screen.findByText('Tap to start playback')).toBeInTheDocument();
  expect(screen.queryByText('Loading video')).not.toBeInTheDocument();
  expect(video.muted).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(video.play).toHaveBeenCalledTimes(2);
  fireEvent.play(video);fireEvent.playing(video);
  expect(screen.queryByText('Tap to start playback')).not.toBeInTheDocument();
  expect(p.onError).not.toHaveBeenCalled();
});

it('desktop controls link adjacent recordings and toggle theater without rebuilding playback',async()=>{
 const p=props();render(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;video.currentTime=45;
 expect(screen.getByRole('link',{name:'Previous video'})).toHaveAttribute('href','/en/member-videos/first');
 expect(screen.getByRole('link',{name:'Next video'})).toHaveAttribute('href','/en/member-videos/third');
 fireEvent.click(screen.getByRole('button',{name:'Theater mode'}));
 expect(screen.getByRole('region')).toHaveAttribute('data-theater','true');
 expect(screen.getByRole('button',{name:'Exit theater mode'})).toHaveAttribute('aria-pressed','true');
 expect(video.currentTime).toBe(45);expect(p.videoRef.current).toBe(video);expect(engine.instances).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Exit theater mode'}));
 expect(screen.getByRole('region')).toHaveAttribute('data-theater','false');
});
