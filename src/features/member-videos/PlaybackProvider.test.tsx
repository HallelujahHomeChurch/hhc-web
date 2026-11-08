import {act, fireEvent, render, screen} from '@testing-library/react';
import {useEffect} from 'react';
import {beforeEach, expect, it, vi} from 'vitest';
import {PlaybackProvider, usePersistentPlayback} from './PlaybackProvider';
import {clearResumeDismissals, dismissResume, isResumeDismissed} from './resume-dismissal';

const account = vi.hoisted(() => ({status: 'authenticated', access: 'available',identity:'member'}));
vi.mock('next/link',()=>({default:({onNavigate,href,children,...props}:import('react').ComponentProps<typeof import('next/link').default>)=><a {...props} href={String(href)} onClick={event=>{event.preventDefault();onNavigate?.({preventDefault:()=>{}});}}>{children}</a>}));
vi.mock('next/navigation', () => ({usePathname:()=>'/video/test',useSearchParams:()=>new URLSearchParams(),useRouter: () => ({push: vi.fn()})}));
vi.mock('@/components/layout/AccountControl', () => ({useAccountIdentity: () => account.identity, useAccountAuth: () => ({status: account.status}), useVideoAccess: () => account.access}));
vi.mock('@/components/layout/MediaDocument', () => ({useMediaDocument: () => ({privateMediaReady: true})}));
vi.mock('./ContinueWatching', () => ({ContinueWatching: () => <aside>Historical resume</aside>}));
const labels = {removeResume: 'Remove from continue watching', resume: 'Resume', live: 'Live', close: 'Close player', expand: 'Expand', minimize: 'Minimize', move: 'Move', resize: 'Resize'};
const flush = vi.fn();
const identity = {recordingId: 'recording', mediaVersion: 'vod:package', sessionId: 'pending-session'};
beforeEach(() => {clearResumeDismissals(); flush.mockReset(); account.status='authenticated'; account.access='available'; account.identity='member';});
const player = <video aria-label="Current recording"/>;
function Playing() {
  const playback = usePersistentPlayback();
  const start = playback?.start, register = playback?.registerPlayback, markStarted = playback?.markStarted;
  useEffect(() => register?.(flush, () => 5, () => identity), [register]);
  useEffect(() => { start?.({key: 'vod:recording:package', href: '/video/aB_012-xyzQ', title: 'Recording', player}); markStarted?.('vod:recording:package'); }, [start, markStarted]);
  return null;
}

it('does not mount historical resume on the homepage or after closing the current mini player', async () => {
  const view = render(<PlaybackProvider locale="en" labels={labels}><main>Home</main></PlaybackProvider>);
  await act(async () => {});
  expect(screen.queryByText('Historical resume')).toBeNull();
  view.rerender(<PlaybackProvider locale="en" labels={labels}><Playing/></PlaybackProvider>);
  expect(screen.getByLabelText('Current recording')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Close player'}));
  await act(async () => {});
  expect(screen.queryByLabelText('Current recording')).toBeNull();
  expect(flush).toHaveBeenCalledTimes(1);
  expect(isResumeDismissed('member', {...identity, generation: 'late-generation'})).toBe(true);
  expect(isResumeDismissed('member', {...identity, sessionId: 'other-device', generation: 'new-generation'})).toBe(false);
  expect(screen.queryByText('Historical resume')).toBeNull();
});


it('keeps persisted dismissal through auth loading and clears it on logout', () => {
  dismissResume('member', identity);
  account.status='checking'; account.access='loading';
  const view=render(<PlaybackProvider locale="en" labels={labels}><main>Home</main></PlaybackProvider>);
  expect(isResumeDismissed('member', identity)).toBe(true);
  account.status='anonymous'; account.access='denied';
  view.rerender(<PlaybackProvider locale="en" labels={labels}><main>Home</main></PlaybackProvider>);
  expect(isResumeDismissed('member', identity)).toBe(false);
});

it('commits minimization once while the watch slot still exists and closes without revival', async () => {
  let controls!: ReturnType<typeof usePersistentPlayback>;
  function Probe() { const value=usePersistentPlayback(); useEffect(()=>{controls=value;},[value]); return <Playing/>; }
  render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
  const slot=document.createElement('div');document.body.append(slot);
  await act(async()=>{controls?.setSlot('vod:recording:package',slot);});
  const video=screen.getByLabelText('Current recording');
  expect(controls?.inWatch).toBe(true);
  const navigate=vi.fn();
  await act(async()=>{controls?.minimize(navigate);controls?.minimize(navigate);});
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(controls?.inWatch).toBe(false);
  expect(screen.getByLabelText('Current recording')).toBe(video);
  fireEvent.click(screen.getByRole('button',{name:'Close player'}));
  await act(async()=>{controls?.setSlot('vod:recording:package',null);});
  expect(screen.queryByLabelText('Current recording')).toBeNull();
  slot.remove();
});

it('clears an unfinished minimize when membership ends before the route arrives', async () => {
  let controls!: ReturnType<typeof usePersistentPlayback>;
  function Probe() { const value=usePersistentPlayback(); useEffect(()=>{controls=value;},[value]); return <Playing/>; }
  const view=render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
  const navigate=vi.fn();
  await act(async()=>{controls?.minimize(navigate);});
  account.access='denied'; account.status='anonymous';
  view.rerender(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
  expect(screen.queryByLabelText('Current recording')).toBeNull();
  account.access='available'; account.status='authenticated';
  view.rerender(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
  await act(async()=>{controls?.minimize(navigate);});
  expect(navigate).toHaveBeenCalledTimes(2);
});

it('caption expansion cancels a pending minimize without replacing the media',async()=>{
 let controls!:ReturnType<typeof usePersistentPlayback>;
 function Probe(){const value=usePersistentPlayback(); useEffect(()=>{controls=value;},[value]);return <Playing/>;}
 render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 const slot=document.createElement('div');document.body.append(slot);
 await act(async()=>{controls?.setSlot('vod:recording:package',slot);});
 const video=screen.getByLabelText('Current recording');
 await act(async()=>{controls?.minimize(vi.fn());});
 expect(controls?.inWatch).toBe(false);
 fireEvent.click(screen.getByRole('link',{name:'Recording'}));
 expect(controls?.inWatch).toBe(true);
 expect(screen.getByLabelText('Current recording')).toBe(video);
 slot.remove();
});

it('offers explicit retry for a slow library route and removes it on close',async()=>{
 vi.useFakeTimers();
 try{
  let controls!:ReturnType<typeof usePersistentPlayback>;
  function Probe(){const value=usePersistentPlayback(); useEffect(()=>{controls=value;},[value]);return <Playing/>;}
  render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
  const navigate=vi.fn();await act(async()=>{controls?.minimize(navigate);});
  expect(screen.queryByRole('button',{name:'Try again'})).toBeNull();
  await act(async()=>{vi.advanceTimersByTime(2000);});
  expect(screen.getByRole('status')).toHaveTextContent('Returning to videos');
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(navigate).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:'Close player'}));
  await act(async()=>{vi.advanceTimersByTime(5000);});
  expect(screen.queryByRole('status')).toBeNull();expect(screen.queryByLabelText('Current recording')).toBeNull();
 }finally{vi.useRealTimers();}
});

it('does not reopen a closed mini when its old watch slot reports again',async()=>{
 let controls!:ReturnType<typeof usePersistentPlayback>;
 function Probe(){const value=usePersistentPlayback(); useEffect(()=>{controls=value;},[value]);return <Playing/>;}
 render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 const slot=document.createElement('div');document.body.append(slot);
 await act(async()=>{controls?.setSlot('vod:recording:package',slot);controls?.minimize(vi.fn());});
 fireEvent.click(screen.getByRole('button',{name:'Close player'}));
 await act(async()=>{controls?.setSlot('vod:recording:package',slot);});
 expect(screen.queryByLabelText('Current recording')).toBeNull();
 const fresh=document.createElement('div');document.body.append(fresh);
 vi.spyOn(fresh,'getBoundingClientRect').mockReturnValue({left:99,top:80,width:640,height:360} as DOMRect);
 await act(async()=>{controls?.setSlot('vod:recording:package',fresh);});
 expect(screen.getByLabelText('Current recording')).toBeInTheDocument();
 await act(async()=>{controls?.setSlot('vod:recording:package',slot);});
 expect(screen.getByLabelText('Current recording').closest('[data-presentation]')).toHaveStyle({left:'99px'});
 fresh.remove();slot.remove();
});

it('shows the source list only for an explicit library snapshot and keeps media while toggling it',async()=>{
 let controls!:ReturnType<typeof usePersistentPlayback>;
 function Probe(){const value=usePersistentPlayback();useEffect(()=>{controls=value;},[value]);return null;}
 render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 await act(async()=>{
  controls?.captureSource({sourceHref:'/member-videos?q=test',items:[{id:'recording',href:'/video/A',title:'First'},{id:'other',href:'/video/B',title:'Second'},{id:'other',href:'/video/B',title:'Stale duplicate'}]},'/video/A');
  controls?.start({key:'vod:recording:package',href:'/video/A',title:'First',player});
 });
 const video=screen.getByLabelText('Current recording');
 expect(screen.getByText('哈利路亞家教會')).toBeInTheDocument();
 const toggle=screen.getByRole('button',{name:'Expand video list'});
 expect(toggle).toHaveAttribute('aria-expanded','false');
 expect(screen.queryByRole('navigation',{name:'Video list'})).toBeNull();
 fireEvent.click(toggle);
 expect(screen.getByRole('navigation',{name:'Video list'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Second'})).toHaveAttribute('href','/video/B');
 expect(screen.queryByText('Stale duplicate')).toBeNull();
 expect(screen.getByLabelText('Current recording')).toBe(video);
 screen.getByRole('link',{name:'Second'}).focus();
 const collapse=screen.getByRole('button',{name:'Collapse video list'});
 fireEvent.click(collapse);
 expect(document.activeElement).toBe(collapse);
 expect(screen.queryByRole('navigation',{name:'Video list'})).toBeNull();
 expect(screen.getByLabelText('Current recording')).toBe(video);
});

it('does not offer a source arrow for direct watch entries',()=>{
 render(<PlaybackProvider locale="en" labels={labels}><Playing/></PlaybackProvider>);
 expect(screen.queryByRole('button',{name:'Expand video list'})).toBeNull();
});

it('clears private source context on account change and rejects old account callbacks',async()=>{
 let controls!:ReturnType<typeof usePersistentPlayback>;
 function Probe(){const value=usePersistentPlayback();useEffect(()=>{controls=value;},[value]);return null;}
 const view=render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 const old=controls;
 await act(async()=>{old?.captureSource({sourceHref:'/videos',items:[{id:'a',href:'/video/A',title:'Private source A'}]},'/video/A');old?.start({key:'a',href:'/video/A',title:'Private source A',player});});
 account.identity='other';view.rerender(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 account.identity='member';view.rerender(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 await act(async()=>{old?.captureSource({sourceHref:'/videos',items:[{id:'a',href:'/video/A',title:'Private source A'}]},'/video/A');old?.start({key:'a',href:'/video/A',title:'Private source A',player});});
 expect(screen.queryByLabelText('Current recording')).toBeNull();
 expect(screen.queryByText('Private source A')).toBeNull();
});


it('gives a returning account a new local-progress store rather than reviving its old writer',()=>{
 const stores:Array<NonNullable<ReturnType<typeof usePersistentPlayback>>['cardProgress']>=[];
 function Capture(){const store=usePersistentPlayback()?.cardProgress;useEffect(()=>{if(store)stores.push(store);},[store]);return null;}
 const show=()=> <PlaybackProvider locale="en" labels={labels}><Capture/></PlaybackProvider>;
 const view=render(show()),first=stores[0],writer=first.bind();
 writer.publish({recordingId:'r1',mediaVersion:'vod:package:1',positionSeconds:40,completed:false});
 account.identity='other';view.rerender(show());account.identity='member';view.rerender(show());
 expect(stores).toHaveLength(3);expect(stores[2]).not.toBe(first);writer.publish({recordingId:'r1',mediaVersion:'vod:package:1',positionSeconds:99,completed:false});expect(stores[2].get('r1','vod:package:1')).toBeNull();
});

it('does not retain a never-started watch after leaving, even after a late playing callback',async()=>{
 let controls!:ReturnType<typeof usePersistentPlayback>;
 function Probe(){const value=usePersistentPlayback();useEffect(()=>{controls=value;},[value]);return null;}
 render(<PlaybackProvider locale="en" labels={labels}><Probe/></PlaybackProvider>);
 const slot=document.createElement('div');document.body.append(slot);
 await act(async()=>{controls?.setSlot('vod:recording:package',slot);controls?.start({key:'vod:recording:package',href:'/video/test',title:'Unstarted',player});});
 expect(screen.getByLabelText('Current recording')).toBeInTheDocument();
 await act(async()=>{controls?.setSlot('vod:recording:package',null);});
 expect(screen.queryByLabelText('Current recording')).toBeNull();
 expect(controls?.activeKey).toBeUndefined();
 await act(async()=>{controls?.markStarted('vod:recording:package');});
 expect(screen.queryByLabelText('Current recording')).toBeNull();
 slot.remove();
});
