import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {BroadcastCover} from './BroadcastWaitingPanel';
import type {createMemberVideoApi} from './api';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps the selected custom image during revision refresh and clears it on revocation',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:custom');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 let reject!:(error:unknown)=>void;
 const api={broadcastCover:vi.fn().mockResolvedValueOnce(new Blob(['jpeg'])).mockImplementationOnce(()=>new Promise((_resolve,rejectNext)=>{reject=rejectNext;}))} as unknown as ReturnType<typeof createMemberVideoApi>;
 const view=render(<BroadcastCover api={api} id="one" title="Service" coverMode="custom" revision="1"/>);
 await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','blob:custom'));
 view.rerender(<BroadcastCover api={api} id="one" title="Service" coverMode="custom" revision="2"/>);
 expect(screen.getByRole('img')).toHaveAttribute('src','blob:custom');
 await act(async()=>reject({status:403}));expect(screen.queryByRole('img')).toBeNull();
});
it('never substitutes branding while a custom cover is initially pending',()=>{
 const api={broadcastCover:vi.fn(()=>new Promise(()=>{}))} as unknown as ReturnType<typeof createMemberVideoApi>;
 const view=render(<BroadcastCover api={api} id="one" title="Service" coverMode="auto" revision="1"/>);
 expect(screen.getByRole('img')).toHaveAttribute('src','/assets/brand/church-live-v1.jpg');
 view.rerender(<BroadcastCover api={api} id="one" title="Service" coverMode="custom" revision="2"/>);
 expect(screen.queryByRole('img')).toBeNull();
});
