import {act, fireEvent, render, screen} from '@testing-library/react';
import {useEffect} from 'react';
import {beforeEach, expect, it, vi} from 'vitest';
import {PlaybackProvider, usePersistentPlayback} from './PlaybackProvider';
import {clearResumeDismissals, dismissResume, isResumeDismissed} from './resume-dismissal';

const account = vi.hoisted(() => ({status: 'authenticated', access: 'available'}));
vi.mock('next/link',()=>({default:({onNavigate,href,children,...props}:import('react').ComponentProps<typeof import('next/link').default>)=><a {...props} href={String(href)} onClick={event=>{event.preventDefault();onNavigate?.({preventDefault:()=>{}});}}>{children}</a>}));
vi.mock('next/navigation', () => ({usePathname:()=>'/video/test',useSearchParams:()=>new URLSearchParams(),useRouter: () => ({push: vi.fn()})}));
vi.mock('@/components/layout/AccountControl', () => ({useAccountIdentity: () => 'member', useAccountAuth: () => ({status: account.status}), useVideoAccess: () => account.access}));
vi.mock('@/components/layout/MediaDocument', () => ({useMediaDocument: () => ({privateMediaReady: true})}));
vi.mock('./ContinueWatching', () => ({ContinueWatching: () => <aside>Historical resume</aside>}));
const labels = {removeResume: 'Remove from continue watching', resume: 'Resume', live: 'Live', close: 'Close player', expand: 'Expand', minimize: 'Minimize', move: 'Move', resize: 'Resize'};
const flush = vi.fn();
const identity = {recordingId: 'recording', mediaVersion: 'vod:package', sessionId: 'pending-session'};
beforeEach(() => {clearResumeDismissals(); flush.mockReset(); account.status='authenticated'; account.access='available';});
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
 expect(screen.getByLabelText('Current recording').closest('[data-presentation]')).toHaveStyle({'--watch-left':'99px'});
 fresh.remove();slot.remove();
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
