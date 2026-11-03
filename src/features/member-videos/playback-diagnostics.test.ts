import {afterEach,expect,it,vi} from 'vitest';
import {createPlaybackDiagnostics} from './playback-diagnostics';
afterEach(()=>{sessionStorage.clear();delete window.hhcPlaybackDiagnostics;vi.restoreAllMocks();});
it('is disabled by default',()=>{createPlaybackDiagnostics()('renew',null,1);expect(window.hhcPlaybackDiagnostics).toBeUndefined();});
it('records bounded media and grant facts without URLs or credentials',()=>{
 sessionStorage.setItem('hhc.playbackDiagnostics','1');const record=createPlaybackDiagnostics();const audio=document.createElement('audio');audio.src='https://private.invalid/token';audio.currentTime=42;audio.playbackRate=1.5;
 Object.defineProperty(audio,'buffered',{value:{length:1,start:()=>40,end:()=>70}});
 for(let i=0;i<300;i++)record('accepted',audio,i,3600);
 expect(window.hhcPlaybackDiagnostics?.events).toHaveLength(256);
 expect(window.hhcPlaybackDiagnostics?.events.at(-1)).toMatchObject({event:'accepted',generation:299,currentTime:42,rate:1.5,buffered:[[40,70]],expiresInSeconds:3600});
 expect(JSON.stringify(window.hhcPlaybackDiagnostics)).not.toMatch(/private|token|src|credential/);
});
it('samples progress at most once per thirty seconds',()=>{
 sessionStorage.setItem('hhc.playbackDiagnostics','1');let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);const record=createPlaybackDiagnostics();record('timeupdate',null,0);now=1000;record('timeupdate',null,0);now=30000;record('timeupdate',null,0);expect(window.hhcPlaybackDiagnostics?.events).toHaveLength(2);
});
it('never interrupts playback when browser media snapshots throw',()=>{
 sessionStorage.setItem('hhc.playbackDiagnostics','1');const record=createPlaybackDiagnostics();const audio=document.createElement('audio');
 Object.defineProperty(audio,'buffered',{configurable:true,get:()=>{throw new Error('detached snapshot');}});expect(()=>record('denied',audio,1)).not.toThrow();
 Object.defineProperty(audio,'buffered',{get:()=>({length:1,start:()=>{throw new Error('changed range');},end:()=>2})});expect(()=>record('accepted',audio,2)).not.toThrow();
});
