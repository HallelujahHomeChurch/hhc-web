import {expect,it} from 'vitest';
import {createPlaybackHistory} from './playback-history';

it('reuses the known list and watch entries for three minimize/expand cycles',()=>{
 let href='/videos?q=faith',length=2,tag='list';let count=0;
 const history=createPlaybackHistory(()=>({href,length,tag}),()=>tag=`entry-${++count}`);
 history.remember('/videos?q=faith','/video/A');
 href='/video/A';length=3;tag='';history.arrived();
 for(let round=0;round<3;round++){
  expect(history.minimize('/videos','/video/A')).toBe('back');
  href='/videos?q=faith';tag='entry-1';history.arrived();
  expect(history.expand('/video/A')).toBe('forward');
  href='/video/A';tag='entry-2';history.arrived();
 }
 expect(length).toBe(3);
});

it('replaces a direct watch and its fallback without adding history entries',()=>{
 let href='/video/A',tag='';const length=1;let count=0;
 const history=createPlaybackHistory(()=>({href,length,tag}),()=>tag=`entry-${++count}`);
 expect(history.minimize('/videos','/video/A')).toBe('replace');
 href='/videos';history.arrived();
 expect(history.expand('/video/A')).toBe('replace');
 href='/video/A';history.arrived();
 expect(history.minimize('/videos','/video/A')).toBe('replace');
});

it('pushes watch after another normal navigation and forgets unknown popstate or reload',()=>{
 let href='/video/A',tag='',length=2;let count=0;
 const read=()=>({href,length,tag}),mark=()=>tag=`entry-${++count}`;
 const history=createPlaybackHistory(read,mark);
 history.minimize('/videos','/video/A');href='/videos';history.arrived();
 href='/about';length++;tag='other';history.arrived();
 expect(history.expand('/video/A')).toBe('push');
 expect(createPlaybackHistory(read,mark).minimize('/videos','/video/A')).toBe('replace');
 history.reset();expect(history.expand('/video/A')).toBe('push');
});

it('rejects intervening navigation, changed entries and incomplete list pushes',()=>{
 let href='/videos',tag='',length=2;let count=0;
 const history=createPlaybackHistory(()=>({href,length,tag}),()=>tag=`entry-${++count}`);
 history.remember('/videos','/video/A');href='/about';history.arrived();
 href='/video/A';length++;history.arrived();expect(history.minimize('/videos','/video/A')).toBe('replace');
 history.reset();href='/videos';history.remember('/videos','/video/A');href='/video/A';history.arrived();
 expect(history.minimize('/videos','/video/A')).toBe('replace');
});

it('recognizes a list push that truncates an existing forward branch',()=>{
 let href='/videos',tag='',length=5;let count=0;
 const history=createPlaybackHistory(()=>({href,length,tag}),()=>tag=`entry-${++count}`);
 history.remember('/videos','/video/B');href='/video/B';length=3;tag='';history.arrived();
 expect(history.minimize('/videos','/video/B')).toBe('back');
});
