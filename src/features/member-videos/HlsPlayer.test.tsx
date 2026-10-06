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
const labels={quality:'Quality',auto:'Auto',play:'Play',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Playback position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Could not exit fullscreen. Retry.',playbackSpeed:'Speed',settings:'Settings',togglePlayback:'Play or pause',privateCopy:'HHC members only',buffering:'Loading video'};
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
afterEach(()=>{cleanup();vi.restoreAllMocks();});

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
