import {afterEach, describe, expect, it, vi} from 'vitest';
import {recordingShareMetadata} from './share-metadata';
import {productLocales} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

const id = '11111111-1111-1111-1111-111111111111';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

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

it('uses the private public origin for canonical short metadata without personal preference headers', async () => {
  const base = 'https://hhc-web-api.internal.fixture.eastasia.azurecontainerapps.io/api';
  vi.stubEnv('HHC_WEB_PUBLIC_API_BASE_URL', base);
  const {videoShareMetadata} = await import('./share-metadata');
  const fetcher=vi.fn().mockResolvedValue(Response.json({data:{title:'Source title'}}));
  vi.stubGlobal('fetch',fetcher);
  const metadata=await videoShareMetadata('FA0AoBO02uU');
  expect(metadata.alternates).toMatchObject({canonical:'https://www.alive.org.tw/video/FA0AoBO02uU'});
  expect(metadata.openGraph).toMatchObject({title:'Source title',images:[{url:'https://www.alive.org.tw/api/video-previews/FA0AoBO02uU/cover'}]});
  expect(fetcher.mock.calls[0][0]).toBe(base + '/video-previews/FA0AoBO02uU');
  expect(fetcher.mock.calls[0][1]).toMatchObject({credentials:'omit',cache:'no-store',redirect:'error'});
  expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
});

it('accepts only eligible exact relative canonical Link headers for legacy redirects', async () => {
  const {legacyVideoPath} = await import('./share-metadata');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({data:{title:'title'}},{headers:{Link:'</video/FA0AoBO02uU>; rel="canonical"'}})));
  expect(await legacyVideoPath(id)).toBe('/video/FA0AoBO02uU');
  for(const link of ['<https://evil.test/video/FA0AoBO02uU>; rel="canonical"','</video/FA0AoBO02uU?token=x>; rel="canonical"','</video/short>; rel="canonical"']) {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({}, {headers:{Link:link}})));
    expect(await legacyVideoPath(id)).toBeUndefined();
  }
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:404,headers:{Link:'</video/FA0AoBO02uU>; rel="canonical"'}})));
  expect(await legacyVideoPath(id)).toBeUndefined();
});
