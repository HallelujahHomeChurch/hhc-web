import {describe, expect, it} from 'vitest';
import {parsePlaylist, scopedURL, validateGrant} from './public-live-load';

const root = 'https://media.alive.org.tw/videos/00000000-0000-4000-8000-000000000001/captures/0123456789abcdef0123456789abcdef/sessions/00000000-0000-4000-8000-000000000002/';
describe('bounded live protocol load', () => {
  it('keeps every request inside its independently granted scope', () => {
    expect(scopedURL('720p/index.m3u8', root+'master.m3u8', root)).toBe(root+'720p/index.m3u8');
    for(const url of ['../../other/master.m3u8','https://elsewhere.example/a','/other/a','720p/a?token=x']) {
      expect(()=>scopedURL(url,root+'master.m3u8',root)).toThrow();
    }
  });
  it('reads variant dimensions and complete fMP4 segments with durations', () => {
    expect(parsePlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720p/index.m3u8').variants).toEqual([{uri:'720p/index.m3u8',height:720}]);
    expect(parsePlaylist('#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:4\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:10,\nseg-000004.m4s\n#EXT-X-ENDLIST')).toMatchObject({init:'init.mp4',segments:[{uri:'seg-000004.m4s',duration:10}],ended:true});
  });
  it('refuses unsupported encrypted, alternate-audio, partial or malformed playlists', () => {
    for(const body of ['#EXTM3U\n#EXT-X-KEY:METHOD=AES-128', '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO', '#EXTM3U\n#EXT-X-BYTERANGE:10@0', '#EXTM3U\n#EXTINF:NaN,\nx', '#EXTM3U\n#EXTINF:0,\nx', '#EXTM3U\nsegment.m4s', '#EXTM3U\n#EXTINF:10,'])expect(()=>parsePlaylist(body)).toThrow();
  });
  it('never extends grants by transport time or ignores terminal state', () => {
    const grant={recordingId:'r',captureId:'c',playbackScopeId:'s',issuedAt:'2026-10-20T00:00:00Z',serverNow:'2026-10-20T00:00:00Z',expiresAt:'2026-10-20T00:05:00Z',captureExpiresAt:'2026-10-20T01:00:00Z',replayUntil:null,liveState:'live'};
    expect(validateGrant(grant,'r','c','s',1000)).toEqual({expires:301000,renew:241000});
    expect(()=>validateGrant({...grant,liveState:'expired'},'r','c','s',1000)).toThrow();
    expect(()=>validateGrant({...grant,expiresAt:'2026-10-20T00:05:01Z'},'r','c','s',1000)).toThrow();
    expect(()=>validateGrant(grant,'r','c','other',1000)).toThrow();
  });
});
