import {expect,it} from 'vitest';
import {liveWindow} from './live-player';
const ranges=(start:number,end:number):TimeRanges=>({length:1,start:()=>start,end:()=>end});
it('keeps full DVR after ninety minutes and a closed-fragment safety distance',()=>{
 expect(liveWindow(ranges(0,5400),5370)).toEqual({start:0,end:5370,edge:5340});
});
it('waits for valid native seekable and never uses Infinity as a duration',()=>{
 expect(liveWindow({length:0,start:()=>0,end:()=>0},90)).toBeNull();
 expect(liveWindow(ranges(0,Infinity),90)).toEqual({start:0,end:90,edge:60});
 expect(liveWindow(ranges(0,90),Infinity)).toBeNull();
});
