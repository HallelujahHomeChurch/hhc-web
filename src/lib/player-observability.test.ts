import {createRequire} from 'node:module';
import {afterEach,expect,it,vi} from 'vitest';
const sentry=vi.hoisted(()=>({captureMessage:vi.fn()}));
vi.mock('@sentry/nextjs',()=>sentry);
import {createPlayerDiagnosticReporter,sanitizePlayerDiagnostic} from './player-observability';
import {sanitizeSentryEvent} from './observability';
afterEach(()=>vi.resetAllMocks());
const batch=()=>({version:1,backend:'hls',mediaSource:'unknown',mode:'vod',videoFrameSupport:'unsupported',events:[{event:'seeking',elapsedMs:0,currentTime:120,rate:1,readyState:2,seeking:true,paused:false}]});
it('projects only bounded diagnostic values and rejects unsupported payloads',()=>{
 const input={...batch(),url:'secret',recordingId:'secret',events:[{...batch().events[0],watermark:'secret',error:new Error('secret'),currentTime:Infinity},...Array.from({length:40},()=>({...batch().events[0]}))]};
 const safe=sanitizePlayerDiagnostic(input);
 expect(safe?.events).toHaveLength(24);expect(safe?.events[0]).not.toHaveProperty('currentTime');
 expect(JSON.stringify(safe)).not.toContain('secret');
 expect(sanitizePlayerDiagnostic({...batch(),backend:'secret'})).toBeNull();
 expect(sanitizePlayerDiagnostic({...batch(),backend:{toString:()=> 'hls',token:'secret'}})).toBeNull();
 expect(sanitizePlayerDiagnostic({...batch(),events:[{event:'secret',elapsedMs:0}]})).toBeNull();
});
it('caps Sentry reports per mounted player without exceptions escaping',()=>{
 const report=createPlayerDiagnosticReporter();
 for(let i=0;i<10;i++)report(batch());
 expect(sentry.captureMessage).toHaveBeenCalledTimes(3);
 sentry.captureMessage.mockImplementation(()=>{throw new Error('offline');});
 expect(()=>createPlayerDiagnosticReporter()(batch())).not.toThrow();
});
it('removes automatic page, identity and breadcrumb context from player events at beforeSend',()=>{
 const event=sanitizeSentryEvent({tags:{player_diagnostic:'seek_v1',title:'secret'},message:'secret',request:{url:'https://private/recording/secret'},user:{id:'secret'},transaction:'secret',breadcrumbs:[{message:'secret'}],extra:{token:'secret'},contexts:{player:{observation:JSON.stringify({...batch(),token:'secret'})},trace:{data:'secret'}},exception:{values:[{stacktrace:'secret'}]}});
 expect(event.contexts).toEqual({player:batch()});expect(event.message).toBe('Player seek diagnostic');
 expect(JSON.stringify(event)).not.toContain('secret');
});

it('preserves bounded events through the installed Sentry normalization before beforeSend',()=>{
 const require=createRequire(import.meta.url);
 const sentryRequire=createRequire(require.resolve('@sentry/nextjs'));
 const {normalize}=sentryRequire('@sentry/core');
 createPlayerDiagnosticReporter()(batch());
 const options=sentry.captureMessage.mock.calls[0][1];
 const event=sanitizeSentryEvent({...options,contexts:normalize(options.contexts,3)});
 expect(event.contexts).toEqual({player:batch()});
});

it('drops malformed, oversized and untrusted encoded diagnostics',()=>{
 for(const observation of ['{', ' '.repeat(16385),JSON.stringify({events:[{url:'secret'}]})]){
  const event=sanitizeSentryEvent({tags:{player_diagnostic:'seek_v1'},contexts:{player:{observation}}});
  expect(event).not.toHaveProperty('contexts');
 }
});
