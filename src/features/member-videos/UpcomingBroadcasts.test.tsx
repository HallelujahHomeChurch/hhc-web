import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {UpcomingBroadcasts} from './UpcomingBroadcasts';
import type {createMemberVideoApi} from './api';
afterEach(cleanup);
it('shows scheduled cards in the main list without a separate upcoming link',async()=>{
 const items=[1,2,3].map(n=>({recordingId:'r'+n,title:'Meeting '+n,view:'waiting',stateRevision:1,scheduledAt:'2026-10-11T01:00:00Z'}));
 const upcoming=vi.fn().mockResolvedValue({items,nextCursor:'r3'});
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" loading="Loading" retry="Retry"/>);
 expect(await screen.findByRole('link',{name:'Meeting 1'})).toHaveAttribute('href','/en/member-videos/r1');
 expect(screen.queryByRole('link',{name:'All upcoming livestreams'})).toBeNull();
 expect(upcoming).toHaveBeenCalledWith(expect.objectContaining({limit:12}));
});
it('loads the next page of upcoming broadcasts without replacing the first',async()=>{
 const upcoming=vi.fn().mockResolvedValueOnce({items:[{recordingId:'r1',title:'Meeting 1',stateRevision:1}],nextCursor:'r1'}).mockResolvedValueOnce({items:[{recordingId:'r2',title:'Meeting 2',stateRevision:1}],nextCursor:null});
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" loading="Loading" retry="Retry"/>);
 await screen.findByRole('link',{name:'Meeting 1'});
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await waitFor(()=>expect(screen.getByRole('link',{name:'Meeting 2'})).toBeVisible());
 expect(screen.getByRole('link',{name:'Meeting 1'})).toBeVisible();
});
it('refreshes an expanded list without retaining cancelled tail entries',async()=>{
 const first={recordingId:'r1',title:'Meeting 1',stateRevision:1},tail={recordingId:'r2',title:'Meeting 2',stateRevision:1};
 const upcoming=vi.fn().mockResolvedValueOnce({items:[first],nextCursor:'r1'}).mockResolvedValueOnce({items:[tail],nextCursor:null}).mockResolvedValue({items:[first],nextCursor:null});
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" loading="Loading" retry="Retry"/>);
 await screen.findByRole('link',{name:'Meeting 1'});
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await screen.findByRole('link',{name:'Meeting 2'});
 fireEvent(document,new Event('visibilitychange'));
 await waitFor(()=>expect(screen.queryByRole('link',{name:'Meeting 2'})).toBeNull());
});
it('refreshes a changed cover even when the broadcast state revision is unchanged',async()=>{
 vi.spyOn(URL,'createObjectURL').mockReturnValueOnce('blob:first-cover').mockReturnValueOnce('blob:updated-cover');
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const item={recordingId:'r1',title:'Meeting',stateRevision:1,cover:{revision:'first',contentPath:'/api/member/recordings/r1/broadcast-cover'}};
 const upcoming=vi.fn().mockResolvedValueOnce({items:[item],nextCursor:null}).mockResolvedValue({items:[{...item,cover:{...item.cover,revision:'updated'}}],nextCursor:null});
 const api={upcoming,broadcastCover:vi.fn().mockResolvedValue(new Blob(['jpeg'],{type:'image/jpeg'}))} as unknown as ReturnType<typeof createMemberVideoApi>;
 try{
  render(<UpcomingBroadcasts api={api} locale="en" loading="Loading" retry="Retry"/>);
  await waitFor(()=>expect(document.querySelector('img[alt="Meeting"]')).toHaveAttribute('src','blob:first-cover'));
  fireEvent(document,new Event('visibilitychange'));
  await waitFor(()=>expect(document.querySelector('img[alt="Meeting"]')).toHaveAttribute('src','blob:updated-cover'));
 }finally{cleanup();vi.restoreAllMocks();}
});

it('keeps the completed VOD boundary visible when a background refresh fails',async()=>{
 const upcoming=vi.fn().mockResolvedValueOnce({items:[],nextCursor:null}).mockRejectedValue(new Error('offline'));
 const onPageState=vi.fn();
 const api={upcoming} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" loading="Loading" retry="Retry" onPageState={onPageState}/>);
 await waitFor(()=>expect(onPageState).toHaveBeenLastCalledWith(expect.objectContaining({ids:[],complete:true})));
 fireEvent(document,new Event('visibilitychange'));
 await screen.findByRole('button',{name:'Retry'});
 expect(onPageState).toHaveBeenLastCalledWith(expect.objectContaining({ids:[],complete:true}));
});

it('distinguishes initial loading from ready scheduled pagination and errors',async()=>{
 let resolve!:(value:unknown)=>void;
 const upcoming=vi.fn().mockImplementation(()=>new Promise(done=>{resolve=done}));
 const onPageState=vi.fn();
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" loading="Loading" retry="Retry" onPageState={onPageState}/>);
 expect(onPageState).toHaveBeenLastCalledWith(expect.objectContaining({initialState:'loading',complete:false}));
 await act(async()=>resolve({items:[{recordingId:'scheduled',title:'Next service',stateRevision:1,view:'waiting'}],nextCursor:'next'}));
 expect(onPageState).toHaveBeenLastCalledWith(expect.objectContaining({initialState:'ready',complete:false}));
});
