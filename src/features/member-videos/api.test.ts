import {describe, expect, it, vi} from 'vitest';
import {createMemberVideoApi} from './api';

const authorization = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};

describe('member video API', () => {
  it('keeps the media credential in a body-only exchange and rejects another host', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, {status: 204}));
    const api = createMemberVideoApi(authorization, fetcher);
    const mediaUrl = 'https://media.alive.org.tw/videos/recording/files/file/sessions/scope/content';
    await expect(api.exchange({mediaUrl, exchangeCredential: 'secret', expiresAt: '', assetVersionId: 'file', watermarkCode: ''})).resolves.toBe(mediaUrl);
    const requestUrl = String(fetcher.mock.calls[0][0]);
    expect(requestUrl).toBe('https://media.alive.org.tw/videos/recording/files/file/sessions/scope/cookie');
    expect(fetcher.mock.calls[0][1]).toMatchObject({method: 'POST', credentials: 'include', body: '{"credential":"secret"}'});
    expect(requestUrl).not.toContain('secret');
    await api.clear(mediaUrl);
    expect(fetcher.mock.calls[1][0].toString()).toBe('https://media.alive.org.tw/videos/recording/files/file/sessions/scope/cookie');
    expect(fetcher.mock.calls[1][1]).toMatchObject({method: 'DELETE', credentials: 'include'});
    await expect(api.exchange({mediaUrl: 'https://evil.example/videos/r/files/f/sessions/s/content', exchangeCredential: 'secret', expiresAt: '', assetVersionId: 'file', watermarkCode: ''})).rejects.toThrow('Invalid media endpoint');
    await expect(api.clear('https://evil.example/videos/r/files/f/sessions/s/content')).rejects.toThrow('Invalid media endpoint');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
