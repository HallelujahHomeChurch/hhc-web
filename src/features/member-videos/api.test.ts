import {describe, expect, it, vi} from 'vitest';
import {createMemberVideoApi} from './api';

const authorization = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};

describe('member video API', () => {
  it('reads private covers before playback using bearer auth, never a query credential', async () => {
    const fetcher=vi.fn().mockResolvedValue(new Response('jpeg',{headers:{'content-type':'image/jpeg'}}));
    const api=createMemberVideoApi(authorization,fetcher);
    expect((await api.cover('recording')).type).toBe('image/jpeg');
    const request=fetcher.mock.calls[0][0] as Request;
    expect(request.url).toBe(new URL('/api/member/recordings/recording/cover',window.location.origin).href);
    expect(request.headers.get('authorization')).toBe('Bearer token');
    expect(request.cache).toBe('no-store');
    expect(request.redirect).toBe('error');
  });
  it('keeps the media credential in a body-only exchange and rejects another host', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, {status: 204}));
    const api = createMemberVideoApi(authorization, fetcher);
    const mediaUrl = 'https://media.alive.org.tw/videos/recording/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/scope/master.m3u8';
    await expect(api.exchange({mediaUrl, exchangeCredential: 'secret', expiresAt: '', assetVersionId: 'file', watermarkCode: ''})).resolves.toBe(mediaUrl);
    const requestUrl = String(fetcher.mock.calls[0][0]);
    expect(requestUrl).toBe('https://media.alive.org.tw/videos/recording/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/scope/cookie');
    expect(fetcher.mock.calls[0][1]).toMatchObject({method: 'POST', credentials: 'include', body: '{"credential":"secret"}'});
    expect(requestUrl).not.toContain('secret');
    await api.clear(mediaUrl);
    expect(fetcher.mock.calls[1][0].toString()).toBe('https://media.alive.org.tw/videos/recording/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/scope/cookie');
    expect(fetcher.mock.calls[1][1]).toMatchObject({method: 'DELETE', credentials: 'include'});
    await expect(api.exchange({mediaUrl: 'https://evil.example/videos/r/files/f/sessions/s/content', exchangeCredential: 'secret', expiresAt: '', assetVersionId: 'file', watermarkCode: ''})).rejects.toThrow('Invalid media endpoint');
    await expect(api.clear('https://evil.example/videos/r/files/f/sessions/s/content')).rejects.toThrow('Invalid media endpoint');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    'https://media.alive.org.tw/videos/r/files/f/sessions/s/content',
    'https://media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/master.m3u8?token=secret',
    'https://user:pass@media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/master.m3u8',
    'https://media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/720p/index.m3u8',
  ])('rejects noncanonical exchange endpoints: %s', async mediaUrl => {
    const fetcher=vi.fn();const api=createMemberVideoApi(authorization,fetcher);
    await expect(api.clear(mediaUrl)).rejects.toThrow('Invalid media endpoint');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('keeps live and VOD exchanges separate and binds every live path ID',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:204}));
 const api=createMemberVideoApi(authorization,fetcher);
 const recordingId='11111111-1111-4111-8111-111111111111',captureId='a'.repeat(32),playbackScopeId='22222222-2222-4222-8222-222222222222';
 const mediaUrl=`https://media.alive.org.tw/videos/${recordingId}/captures/${captureId}/sessions/${playbackScopeId}/master.m3u8`;
 const grant={recordingId,captureId,playbackScopeId,mediaUrl,exchangeCredential:'secret',issuedAt:'',expiresAt:'',serverNow:'',captureExpiresAt:'',stopAcceptedAt:null,replayUntil:null,terminalReason:null,liveState:'live' as const,progress:{revision:3,firstSequence:0 as const,lastSequence:2,mediaEndSeconds:90,lastAdvancedAt:null,endedAt:null,ended:false},watermarkCode:'trace'};
 await expect(api.exchangeLive(grant)).resolves.toBe(mediaUrl);
 expect(String(fetcher.mock.calls[0][0])).toBe(mediaUrl.replace('master.m3u8','cookie'));
 await expect(api.exchangeLive({...grant,captureId:'b'.repeat(32)})).rejects.toThrow('Invalid media endpoint');
 await expect(api.exchange({...grant,assetVersionId:captureId})).rejects.toThrow('Invalid media endpoint');
 await api.clearLive(mediaUrl);expect(fetcher).toHaveBeenCalledTimes(2);
});
