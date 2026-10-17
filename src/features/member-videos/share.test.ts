import {expect,it} from 'vitest';
import {videoShareURL,videoStartTime} from './share';
it('accepts only bounded whole seconds and removes unrelated URL parameters',()=>{
 for(const value of ['-1','NaN','Infinity','1.2','604801',['1','2'],'01'])expect(videoStartTime(value)).toBeUndefined();
 expect(videoStartTime('120')).toBe(120);
 expect(videoShareURL('https://www.example/zh/member-videos/id?foo=bar#old',120.9)).toBe('https://www.example/zh/member-videos/id?t=120');
 expect(videoShareURL('https://www.example/zh/member-videos/id?t=10')).toBe('https://www.example/zh/member-videos/id');
});
it('parses editable clock times without accepting ambiguous or out-of-range values',async()=>{
 const {parseShareTime}=await import('./share');
 expect(parseShareTime('1:02:03',4000)).toBe(3723);expect(parseShareTime('0:00',0)).toBe(0);
 for(const value of ['1:60','-1','1:2:3:4','Infinity','604801','1.5'])expect(parseShareTime(value)).toBeUndefined();
 expect(parseShareTime('2:00',60)).toBeUndefined();
});
