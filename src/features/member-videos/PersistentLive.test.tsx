import type {ComponentProps} from 'react';
import {render,waitFor,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PersistentLive} from './PersistentLive';

const close=vi.hoisted(()=>vi.fn());
vi.mock('./PlaybackProvider',()=>({usePersistentPlayback:()=>({inWatch:false,activeKey:'live:A:capture',labels:{},close})}));
vi.mock('./LiveRecordingPlayer',()=>({LiveRecordingPlayer:()=>null}));
afterEach(()=>{cleanup();close.mockReset();});
it.each(['expired','cancelled'])('closes the mini-player when watch returns 200 with %s',async view=>{
 const props={recording:{id:'A',captureId:'capture'},api:{watch:vi.fn().mockResolvedValue({recordingId:'A',view,live:null})}} as unknown as ComponentProps<typeof PersistentLive>;
 render(<PersistentLive {...props}/>);
 await waitFor(()=>expect(close).toHaveBeenCalledWith('live:A:capture'));
});
it('retains the authorized live replay while the recording is processing',async()=>{
 const watch=vi.fn().mockResolvedValue({recordingId:'A',view:'processing',live:null});
 const props={recording:{id:'A',captureId:'capture'},api:{watch}} as unknown as ComponentProps<typeof PersistentLive>;
 render(<PersistentLive {...props}/>);
 await waitFor(()=>expect(watch).toHaveBeenCalledOnce());
 expect(close).not.toHaveBeenCalled();
});
