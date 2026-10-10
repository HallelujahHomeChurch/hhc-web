import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {UpcomingBroadcasts} from './UpcomingBroadcasts';
import type {createMemberVideoApi} from './api';
afterEach(cleanup);
it('shows three upcoming cards with a full-list entry and no media grants',async()=>{
 const items=[1,2,3].map(n=>({recordingId:'r'+n,title:'Meeting '+n,view:'waiting',stateRevision:1,scheduledAt:'2026-10-11T01:00:00Z'}));
 const upcoming=vi.fn().mockResolvedValue({items,nextCursor:'r3'});
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" full={false} loading="Loading" retry="Retry"/>);
 expect(await screen.findByRole('link',{name:'Meeting 1'})).toHaveAttribute('href','/en/member-videos/r1');
 expect(screen.getByRole('link',{name:'All upcoming livestreams'})).toHaveAttribute('href','/en/member-videos?upcoming=1');
 expect(upcoming).toHaveBeenCalledWith(expect.objectContaining({limit:3}));
});
it('loads the next page of upcoming broadcasts without replacing the first',async()=>{
 const upcoming=vi.fn().mockResolvedValueOnce({items:[{recordingId:'r1',title:'Meeting 1',stateRevision:1}],nextCursor:'r1'}).mockResolvedValueOnce({items:[{recordingId:'r2',title:'Meeting 2',stateRevision:1}],nextCursor:null});
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" full loading="Loading" retry="Retry"/>);
 await screen.findByRole('link',{name:'Meeting 1'});
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await waitFor(()=>expect(screen.getByRole('link',{name:'Meeting 2'})).toBeVisible());
 expect(screen.getByRole('link',{name:'Meeting 1'})).toBeVisible();
});
it('refreshes an expanded list without retaining cancelled tail entries',async()=>{
 const first={recordingId:'r1',title:'Meeting 1',stateRevision:1},tail={recordingId:'r2',title:'Meeting 2',stateRevision:1};
 const upcoming=vi.fn().mockResolvedValueOnce({items:[first],nextCursor:'r1'}).mockResolvedValueOnce({items:[tail],nextCursor:null}).mockResolvedValue({items:[first],nextCursor:null});
 const api={upcoming,broadcastCover:vi.fn().mockRejectedValue(new Error('none'))} as unknown as ReturnType<typeof createMemberVideoApi>;
 render(<UpcomingBroadcasts api={api} locale="en" full loading="Loading" retry="Retry"/>);
 await screen.findByRole('link',{name:'Meeting 1'});
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await screen.findByRole('link',{name:'Meeting 2'});
 fireEvent(document,new Event('visibilitychange'));
 await waitFor(()=>expect(screen.queryByRole('link',{name:'Meeting 2'})).toBeNull());
});
