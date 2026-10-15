import {expect,it} from 'vitest';
import {videoShareURL,videoStartTime} from './share';
it('accepts only bounded whole seconds and removes unrelated URL parameters',()=>{
 for(const value of ['-1','NaN','Infinity','1.2','604801',['1','2'],'01'])expect(videoStartTime(value)).toBeUndefined();
 expect(videoStartTime('120')).toBe(120);
 expect(videoShareURL('https://www.example/zh/member-videos/id?foo=bar#old',120.9)).toBe('https://www.example/zh/member-videos/id?t=120');
 expect(videoShareURL('https://www.example/zh/member-videos/id?t=10')).toBe('https://www.example/zh/member-videos/id');
});
