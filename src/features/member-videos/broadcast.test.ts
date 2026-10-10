import {describe,expect,it} from 'vitest';
import {broadcastPollDelay,countdownSeconds,mapBroadcastBookmark} from './broadcast';

describe('broadcast viewer timeline',()=>{
 it('waits at zero rather than claiming the scheduled broadcast is live',()=>{
  expect(countdownSeconds('2026-10-10T01:00:00Z','2026-10-10T00:59:00Z',30)).toBe(30);
  expect(countdownSeconds('2026-10-10T01:00:00Z','2026-10-10T01:01:00Z',0)).toBe(0);
 });
 it('uses slow hidden polling and bounded failure backoff',()=>{
  expect(broadcastPollDelay('waiting',false,0)).toBe(15000);
  expect(broadcastPollDelay('live',false,0)).toBe(5000);
  expect(broadcastPollDelay('live',true,0)).toBe(60000);
  expect(broadcastPollDelay('waiting',false,10)).toBe(60000);
 });
 it('maps source media origin while preserving DVR pause speed and quality',()=>{
  const b={time:270,paused:true,rate:1.5,quality:'1080p' as const,intent:'dvr' as const,mediaOriginSeconds:0};
  expect(mapBroadcastBookmark(b,240,360)).toEqual({...b,time:30,mediaOriginSeconds:240});
  expect(mapBroadcastBookmark({...b,time:800},240,360)?.time).toBe(360);
  expect(mapBroadcastBookmark(undefined,240,360)).toBeUndefined();
 });
});
