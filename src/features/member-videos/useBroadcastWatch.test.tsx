import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,renderHook,waitFor} from '@testing-library/react';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {useBroadcastWatch} from './useBroadcastWatch';
import type {createMemberVideoApi} from './api';
afterEach(cleanup);
it('drops playback authority when watch access is revoked',async()=>{
 const watch=vi.fn().mockRejectedValue(new HhcWebApiError(403,'forbidden','forbidden'));
 const api={watch} as unknown as ReturnType<typeof createMemberVideoApi>;
 const {result}=renderHook(()=>useBroadcastWatch(api,'r1',0));
 await waitFor(()=>expect(result.current.denied).toBe(true));
 expect(result.current.watch).toBeNull();
});
it('resolves an unlisted scheduled ID directly and cancels the read on unmount',async()=>{
 const watch=vi.fn().mockResolvedValue({recordingId:'outside-page',view:'waiting'});
 const api={watch} as unknown as ReturnType<typeof createMemberVideoApi>;
 const {result,unmount}=renderHook(()=>useBroadcastWatch(api,'outside-page',0));
 await waitFor(()=>expect(result.current.watch?.recordingId).toBe('outside-page'));
 const signal=watch.mock.calls[0][1] as AbortSignal;unmount();expect(signal.aborted).toBe(true);
});
