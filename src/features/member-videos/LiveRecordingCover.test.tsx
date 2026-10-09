import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {LiveRecordingCover} from './RecordingCover';
import type {createMemberVideoApi} from './api';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
afterEach(()=>{cleanup();vi.restoreAllMocks()});
const recording={id:'one',captureId:'a'.repeat(32),title:'Live service',createdAt:new Date().toISOString(),coverRevision:'image-1'} as MemberLiveRecording;
it('loads a private live image once per revision and keeps it on a temporary update failure',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:live');const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const liveCover=vi.fn().mockResolvedValueOnce(new Blob(['jpeg'])).mockRejectedValueOnce(new Error('network unavailable'));
 const api={liveCover} as unknown as ReturnType<typeof createMemberVideoApi>;
 const view=render(<LiveRecordingCover api={api} recording={recording}/>);
 await waitFor(()=>expect(screen.getByRole('img',{name:recording.title})).toHaveAttribute('src','blob:live'));
 view.rerender(<LiveRecordingCover api={api} recording={{...recording}}/>);
 expect(liveCover).toHaveBeenCalledTimes(1);
 view.rerender(<LiveRecordingCover api={api} recording={{...recording,coverRevision:'image-2'}}/>);
 await waitFor(()=>expect(liveCover).toHaveBeenCalledTimes(2));
 expect(screen.getByRole('img',{name:recording.title})).toHaveAttribute('src','blob:live');expect(revoke).not.toHaveBeenCalled();
 view.unmount();expect(revoke).toHaveBeenCalledWith('blob:live');
});
it('rejects a late previous capture response and clears images after authorization failure',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:new');const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 let done!:(blob:Blob)=>void;
 const liveCover=vi.fn().mockImplementationOnce(()=>new Promise<Blob>(resolve=>{done=resolve})).mockResolvedValueOnce(new Blob(['new'])).mockRejectedValueOnce({status:403});
 const api={liveCover} as unknown as ReturnType<typeof createMemberVideoApi>,next={...recording,captureId:'b'.repeat(32)};
 const view=render(<LiveRecordingCover api={api} recording={recording}/>);
 view.rerender(<LiveRecordingCover api={api} recording={next}/>);
 await waitFor(()=>expect(screen.getByRole('img',{name:recording.title})).toHaveAttribute('src','blob:new'));
 await act(async()=>done(new Blob(['old'])));
 view.rerender(<LiveRecordingCover api={api} recording={{...next,coverRevision:'image-2'}}/>);
 await waitFor(()=>expect(screen.queryByRole('img',{name:recording.title})).toBeNull());expect(revoke).toHaveBeenCalledWith('blob:new');
});

it('discards account-instance images and never reuses the previous private URL',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValueOnce('blob:account-one').mockReturnValueOnce('blob:account-two');const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const first={liveCover:vi.fn().mockResolvedValue(new Blob(['one']))} as unknown as ReturnType<typeof createMemberVideoApi>;
 const second={liveCover:vi.fn().mockResolvedValue(new Blob(['two']))} as unknown as ReturnType<typeof createMemberVideoApi>;
 const view=render(<LiveRecordingCover api={first} recording={recording}/>);
 await waitFor(()=>expect(screen.getByRole('img',{name:recording.title})).toHaveAttribute('src','blob:account-one'));
 view.rerender(<LiveRecordingCover api={second} recording={recording}/>);
 expect(screen.queryByRole('img',{name:recording.title})).toBeNull();
 await waitFor(()=>expect(screen.getByRole('img',{name:recording.title})).toHaveAttribute('src','blob:account-two'));
 expect(revoke).toHaveBeenCalledWith('blob:account-one');
});
it('revokes an expired capture image even without another list render',async()=>{
 vi.useFakeTimers();vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:expiring');const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const api={liveCover:vi.fn().mockResolvedValue(new Blob(['one']))} as unknown as ReturnType<typeof createMemberVideoApi>;
 try{
  await act(async()=>{render(<LiveRecordingCover api={api} recording={{...recording,createdAt:new Date(Date.now()-24*60*60*1000+1000).toISOString()}}/>)});
  expect(screen.getByRole('img',{name:recording.title})).toHaveAttribute('src','blob:expiring');
  await act(()=>vi.advanceTimersByTimeAsync(30_000));
  expect(screen.queryByRole('img',{name:recording.title})).toBeNull();expect(revoke).toHaveBeenCalledWith('blob:expiring');
 }finally{vi.useRealTimers()}
});
