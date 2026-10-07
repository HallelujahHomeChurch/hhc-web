import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {HhcWebApiError, type MemberLivePlayback} from '@hallelujahhomechurch/hhc-web-client';
import {useLivePlayback} from './useLivePlayback';

const id='11111111-1111-4111-8111-111111111111', capture='a'.repeat(32);
function setup(){
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-07T00:00:00Z'));
 const api={liveGrant:vi.fn(async (_id:string,_capture:string,scope:string):Promise<MemberLivePlayback>=>({recordingId:id,captureId:capture,playbackScopeId:scope,mediaUrl:`https://media.alive.org.tw/videos/${id}/captures/${capture}/sessions/${scope}/master.m3u8`,exchangeCredential:'secret',serverNow:new Date(Date.now()+3600000).toISOString(),issuedAt:new Date(Date.now()+3600000).toISOString(),expiresAt:new Date(Date.now()+3900000).toISOString(),captureExpiresAt:new Date(Date.now()+86400000).toISOString(),replayUntil:null,stopAcceptedAt:null,terminalReason:null,liveState:'live',progress:{revision:3,firstSequence:0,lastSequence:2,mediaEndSeconds:90,lastAdvancedAt:null,endedAt:null,ended:false},watermarkCode:'trace'})),exchangeLive:vi.fn(async(g:MemberLivePlayback)=>g.mediaUrl),clearLive:vi.fn().mockResolvedValue(undefined)};
 return {api,...renderHook(()=>useLivePlayback(api,id,capture))};
}
afterEach(()=>{cleanup();vi.useRealTimers();});
it('renews five-minute grants at four minutes using server time without remounting or changing scope',async()=>{
 const {api,result}=setup();await act(()=>result.current.start());const first=result.current.playback;
 await act(()=>vi.advanceTimersByTimeAsync(239000));expect(api.liveGrant).toHaveBeenCalledTimes(1);
 await act(()=>vi.advanceTimersByTimeAsync(1000));expect(api.liveGrant).toHaveBeenCalledTimes(2);
 expect(api.liveGrant.mock.calls[1][2]).toBe(api.liveGrant.mock.calls[0][2]);expect(result.current.playback?.url).toBe(first?.url);expect(api.clearLive).not.toHaveBeenCalled();
});
it.each([true,false])('unloads at the old expiry and serializes cookie cleanup with renewal success=%s',async(renewed)=>{
 const {api,result}=setup();await act(()=>result.current.start());
 let finishExchange!:()=>void,finishDelete!:()=>void,cookie=true;
 api.exchangeLive.mockImplementationOnce(async grant=>{await new Promise<void>(resolve=>{finishExchange=resolve;});if(!renewed)throw new Error('offline');cookie=true;return grant.mediaUrl;});
 api.clearLive.mockImplementation(async()=>{await new Promise<void>(resolve=>{finishDelete=resolve;});cookie=false;});
 await act(()=>vi.advanceTimersByTimeAsync(240000));
 await act(()=>vi.advanceTimersByTimeAsync(60000));
 expect(result.current.playback).toBeNull();expect(api.clearLive).not.toHaveBeenCalled();
 await act(async()=>{finishExchange();});
 await act(async()=>{finishDelete?.();});
 expect(Boolean(result.current.playback)).toBe(renewed);expect(cookie).toBe(renewed);
 expect(api.clearLive).toHaveBeenCalledTimes(renewed?0:1);
});
it('BackgroundSleepResumesExpiredGrantSameScope preserves a paused DVR bookmark after fifteen minutes',async()=>{
 const {api,result}=setup();await act(()=>result.current.start());const scope=api.liveGrant.mock.calls[0][2];
 const bookmark={time:60,paused:true,rate:1.5,quality:'720p' as const,intent:'dvr' as const};act(()=>result.current.remember(bookmark));
 vi.setSystemTime(new Date(Date.now()+15*60000));
 await act(async()=>{window.dispatchEvent(new Event('pageshow'));});
 expect(api.clearLive).toHaveBeenCalledTimes(1);expect(api.liveGrant).toHaveBeenCalledTimes(2);expect(api.liveGrant.mock.calls[1][2]).toBe(scope);expect(result.current.bookmark.current).toEqual(bookmark);expect(result.current.playback).not.toBeNull();
});
it('bounds transient retries, unloads at expiry and retries the same scope online',async()=>{
 const {api,result}=setup();await act(()=>result.current.start());const scope=api.liveGrant.mock.calls[0][2];
 api.liveGrant.mockRejectedValue(new Error('offline'));
 await act(()=>vi.advanceTimersByTimeAsync(300000));expect(result.current.playback).toBeNull();expect(api.liveGrant.mock.calls.length).toBeLessThan(8);
 const calls=api.liveGrant.mock.calls.length;
 await act(()=>vi.advanceTimersByTimeAsync(600000));expect(api.liveGrant).toHaveBeenCalledTimes(calls);
 await act(async()=>{window.dispatchEvent(new Event('online'));});expect(api.liveGrant.mock.calls.at(-1)?.[2]).toBe(scope);
});

it('stops on revoked membership and never creates another viewer scope',async()=>{
 const {api,result}=setup();await act(()=>result.current.start());
 api.liveGrant.mockRejectedValue(new HhcWebApiError(403,'forbidden','Denied'));
 await act(()=>vi.advanceTimersByTimeAsync(240000));expect(result.current.closed).toBe(true);expect(result.current.playback).toBeNull();
 await act(async()=>{window.dispatchEvent(new Event('online'));await result.current.start();});expect(api.liveGrant).toHaveBeenCalledTimes(2);
});

it('renews a thirty-second grant once at 24 seconds without a one-second loop',async()=>{
 const {api,result}=setup();const original=api.liveGrant.getMockImplementation()!;
 api.liveGrant.mockImplementation(async(...args)=>{const grant=await original(...args);return {...grant,expiresAt:new Date(Date.parse(grant.serverNow)+30000).toISOString()};});
 await act(()=>result.current.start());await act(()=>vi.advanceTimersByTimeAsync(23000));expect(api.liveGrant).toHaveBeenCalledTimes(1);
 await act(()=>vi.advanceTimersByTimeAsync(1000));expect(api.liveGrant).toHaveBeenCalledTimes(2);
 await act(()=>vi.advanceTimersByTimeAsync(1000));expect(api.liveGrant).toHaveBeenCalledTimes(2);
});
