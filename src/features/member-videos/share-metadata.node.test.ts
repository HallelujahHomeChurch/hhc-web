import {afterEach, describe, expect, it, vi} from 'vitest';
import {recordingShareMetadata} from './share-metadata';
import {productLocales} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

const id = '11111111-1111-1111-1111-111111111111';
afterEach(() => vi.unstubAllGlobals());

describe('single-recording public share metadata', () => {
  it.each(productLocales)('uses only the public title and selected cover for %s', async locale => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({data: {title: 'Shared title', description: 'PRIVATE', packageId: 'PRIVATE'}}));
    vi.stubGlobal('fetch', fetcher);
    const result = await recordingShareMetadata(locale, id);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/api/recording-previews/${id}$`)), expect.objectContaining({cache: 'no-store', credentials: 'omit', redirect: 'error', signal: expect.any(AbortSignal)}));
    expect(result).toMatchObject({
      title: 'Shared title', robots: {index: false, follow: false, noarchive: true},
      description: getMessages(locale).memberVideos.shareDescription,
      openGraph: {
        title: 'Shared title', url: `https://www.alive.org.tw/${locale}/member-videos/${id}`,
        images: [{url: `https://www.alive.org.tw/api/recording-previews/${id}/cover`, alt: 'Shared title'}]
      }
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it.each([404, 503])('uses a generic card for unavailable previews (%s)', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status})));
    const result = await recordingShareMetadata('en', id);
    expect(result.openGraph).toMatchObject({images: [{url: 'https://www.alive.org.tw/opengraph-image'}]});
    expect(result.robots).toMatchObject({index: false});
  });

  it.each([null, {data: {title: ''}}, {data: {title: 'a'.repeat(181)}}, {data: {title: {url: 'PRIVATE'}}}])('fails closed on malformed metadata: %j', async value => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)));
    expect((await recordingShareMetadata('en', id)).title).toBe(getMessages('en').memberVideos.selectedTitle);
  });

  it('keeps the page available during an upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect((await recordingShareMetadata('en', id)).title).toBe(getMessages('en').memberVideos.selectedTitle);
  });

  it('never fetches a path supplied as a recording identifier', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await recordingShareMetadata('en', '../../member/recordings');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
