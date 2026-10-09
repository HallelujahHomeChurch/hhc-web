import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {RecordingCover} from './RecordingCover';
import type {createMemberVideoApi} from './api';
afterEach(()=>{cleanup();vi.restoreAllMocks()});
it('replaces and revokes a selected cover when its revision changes',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValueOnce('blob:old').mockReturnValueOnce('blob:new');
 const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const api={cover:vi.fn().mockResolvedValue(new Blob(['jpeg']))} as unknown as ReturnType<typeof createMemberVideoApi>;
 const view=render(<RecordingCover api={api} id="one" title="One" revision="old"/>);
 await screen.findByRole('img');
 view.rerender(<RecordingCover api={api} id="one" title="One" revision="new"/>);
 expect(revoke).toHaveBeenCalledWith('blob:old');
 await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','blob:new'));
});
it('releases private object URLs and rejects stale responses after changing recording',async()=>{
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:cover');
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  let resolve!:(blob:Blob)=>void;
  const cover=vi.fn().mockResolvedValueOnce(new Blob(['jpeg'])).mockImplementationOnce(()=>new Promise<Blob>(done=>{resolve=done})).mockResolvedValueOnce(new Blob(['new']));
  const api={cover} as unknown as ReturnType<typeof createMemberVideoApi>;
  const view=render(<RecordingCover api={api} id="one" title="One"/>);
  expect(await screen.findByRole('img',{name:'One'})).toHaveAttribute('src','blob:cover');
  view.rerender(<RecordingCover api={api} id="two" title="Two"/>);
  expect(revoke).toHaveBeenCalledWith('blob:cover');
  expect(screen.queryByRole('img')).toBeNull();
  view.rerender(<RecordingCover api={api} id="three" title="Three"/>);
  await screen.findByRole('img',{name:'Three'});
  resolve(new Blob(['late']));
  await waitFor(()=>expect(create).toHaveBeenCalledTimes(2));
  view.unmount();
  expect(revoke).toHaveBeenCalledTimes(2);
});

it('defers offscreen cover bytes until the card approaches the viewport',async()=>{
 let notify!:(entries:Partial<IntersectionObserverEntry>[])=>void;
 const disconnect=vi.fn();
 vi.stubGlobal('IntersectionObserver',class {constructor(callback:typeof notify){notify=callback} observe(){} disconnect=disconnect});
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:near');
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const cover=vi.fn().mockResolvedValue(new Blob(['jpeg']));
 render(<RecordingCover api={{cover} as unknown as ReturnType<typeof createMemberVideoApi>} id="one" title="One"/>);
 expect(cover).not.toHaveBeenCalled();
 notify([{isIntersecting:true}]);
 await screen.findByRole('img');
 expect(cover).toHaveBeenCalledOnce();
 expect(disconnect).toHaveBeenCalled();
 vi.unstubAllGlobals();
});
