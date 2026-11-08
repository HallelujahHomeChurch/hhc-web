import {expect,it} from 'vitest';
import {availableMiniRect,miniRect,pullRect} from './mini-geometry';
const zero={top:0,right:0,bottom:0,left:0};
it('reserves the visible navigation and four safe edges',()=>{
 expect(availableMiniRect({left:0,top:0,width:390,height:844},{...zero,top:47,bottom:34},{left:0,top:748,width:390,height:96})).toEqual({left:16,top:47,right:374,bottom:732});
 expect(availableMiniRect({left:80,top:300,width:390,height:400},zero,{left:0,top:748,width:390,height:96})).toEqual({left:96,top:316,right:454,bottom:684});
});
it('fits a right-bottom mini and preserves aspect ratio inside a tiny viewport',()=>{
 expect(miniRect({left:16,top:16,right:374,bottom:766},240,0,false,false)).toEqual({left:134,top:631,width:240,height:135});
 expect(miniRect({left:16,top:16,right:144,bottom:160},240,0,false,false)).toEqual({left:16,top:88,width:128,height:72});
});
it('starts without a lock jump, then follows a fixed diagonal path at a fixed progress',()=>{
 const start={left:0,top:80,width:390,height:219.375},end={left:134,top:631,width:240,height:135};
 expect(pullRect(start,end,16,16)).toEqual(start);
 expect(pullRect(start,end,291.5,16)).toEqual({left:67,top:355.5,width:315,height:177.1875});
 expect(pullRect(start,end,999,16)).toEqual(end);
 expect(pullRect(start,end,8,16)).toEqual(start);
});
