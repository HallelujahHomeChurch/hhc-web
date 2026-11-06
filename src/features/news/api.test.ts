import {afterEach, describe, expect, it, vi} from 'vitest';
import {publicContentClient} from '@/features/content/client';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getNews, getNewsBySlug, getNewsPage} from './api';

describe('getNews', () => {
  it('maps published news projections without using fixtures', async () => {
    const client = {listPublicContent: async () => [{id: 'news-1', title: '消息', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en'], summary: '摘要', displayDate: '2026-07-13', imageAlt: '封面', imageUrl: '/assets/detail/large', homeImageUrl: '/assets/home/large', href: '/ja/news/news-1'}]} as unknown as HhcWebClient;
    const [item] = await getNews('ja', client);

    expect(item).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      date: '2026年7月13日',
      href: '/ja/news/news-1'
    });
    expect(item.imageSrc).toBe('/assets/home/large');
    expect(item).toMatchObject({requestedLocale: 'ja', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en']});
  });

  it('maps a news detail without treating its body as markup', async () => {
    const client = {getNewsBySlug: async () => ({
      id: 'news-1',
      title: 'お知らせ',
      resolvedLocale: 'ja',
      availableLocales: ['zh-Hant', 'ja'],
      body: '<script>alert(1)</script>',
      displayDate: '2026-08-14',
      authorName: 'Pastor Wang',
      firstPublishedAt: '2026-08-14T01:00:00Z',
      lastPublishedAt: '2026-08-14T02:00:00Z',
      detailLayout: 'left',
      href: '/ja/news/news-1'
    })} as unknown as HhcWebClient;

    await expect(getNewsBySlug('ja', 'news-1', client)).resolves.toMatchObject({
      title: 'お知らせ',
      requestedLocale: 'ja',
      resolvedLocale: 'ja',
      availableLocales: ['zh-Hant', 'ja'],
      body: '<script>alert(1)</script>',
      displayDate: '2026-08-14',
      authorName: 'Pastor Wang',
      firstPublishedAt: '2026-08-14T01:00:00Z',
      lastPublishedAt: '2026-08-14T02:00:00Z',
      layout: 'left'
    });
  });

  it('uses an exact Korean projection and its date semantics when available', async () => {
    const client = {listPublicContent: async () => [{
      id: 'news-ko',
      title: '공지',
      resolvedLocale: 'ko',
      availableLocales: ['zh-Hant', 'ko'],
      displayDate: '2026-08-09',
      href: '/ko/news/news-ko'
    }]} as unknown as HhcWebClient;

    await expect(getNews('ko', client)).resolves.toMatchObject([{
      title: '공지',
      date: '2026년 8월 9일',
      requestedLocale: 'ko',
      resolvedLocale: 'ko',
      availableLocales: ['zh-Hant', 'ko'],
      href: '/ko/news/news-ko'
    }]);
  });

  it('bounds malformed or missing runtime locale metadata without inventing availability', async () => {
    const client = {listPublicContent: async () => [
      {id: 'malformed', title: 'Malformed', resolvedLocale: 'future', availableLocales: ['zh-Hant', 'future', 'zh-Hant'], href: '/ko/news/malformed'},
      {id: 'missing', title: 'Missing', href: '/ko/news/missing'}
    ]} as unknown as HhcWebClient;

    await expect(getNews('ko', client)).resolves.toMatchObject([
      {requestedLocale: 'ko', resolvedLocale: 'ko', availableLocales: ['zh-Hant'], href: '/ko/news/malformed'},
      {requestedLocale: 'ko', resolvedLocale: 'ko', availableLocales: [], href: '/ko/news/missing'}
    ]);
  });

  it('keeps public pagination metadata', async () => {
    const client = {listPublicContentPage: async () => ({
      data: [{id: 'news-1', title: '消息', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant']}],
      meta: {page: 2, pageSize: 12, total: 25}
    })} as unknown as HhcWebClient;

    await expect(getNewsPage('zh-Hant', 2, 12, client)).resolves.toMatchObject({
      items: [{title: '消息', requestedLocale: 'zh-Hant', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant']}],
      meta: {page: 2, pageSize: 12, total: 25}
    });
  });
});

describe('ordinary News transport', () => {
  const privateBase = 'https://hhc-web-api.internal.example.eastasia.azurecontainerapps.io/api';
  const daprBase = 'http://127.0.0.1:3500/v1.0/invoke/hhc-web-api/method/api';

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('switches paged list and default detail while keeping the explicit no-store reader on Dapr', async () => {
    vi.stubEnv('HHC_WEB_NEWS_API_BASE_URL', privateBase);
    vi.stubEnv('HHC_WEB_API_BASE_URL', daprBase);
    const item = {id: 'one', title: 'Published'};
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => Response.json({data: [item], meta: {page: 2, pageSize: 12, total: 25}}))
      .mockImplementation(async () => Response.json({data: item}));
    vi.stubGlobal('fetch', fetch);

    await expect(getNewsPage('ja', 2, 12)).resolves.toMatchObject({meta: {page: 2, pageSize: 12, total: 25}});
    await getNewsBySlug('en', 'ordinary-news');
    await getNewsBySlug('en', 'statement', publicContentClient(true));

    expect(fetch.mock.calls.map(([request]) => (request as Request).url)).toEqual([
      privateBase + '/news?locale=ja&page=2&pageSize=12',
      privateBase + '/news/ordinary-news?locale=en',
      daprBase + '/news/statement?locale=en'
    ]);
    for (const [request, init] of fetch.mock.calls.slice(0, 2)) {
      expect((request as Request).headers.get('authorization')).toBeNull();
      expect(init).toMatchObject({redirect: 'error', next: {revalidate: 60}});
    }
    expect(fetch.mock.calls[2][1]).toMatchObject({redirect: 'error', cache: 'no-store'});
  });

  it('keeps default detail on Dapr with the flag off and propagates 404', async () => {
    vi.stubEnv('HHC_WEB_NEWS_API_BASE_URL', undefined);
    vi.stubEnv('HHC_WEB_API_BASE_URL', daprBase);
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementation(async () => Response.json({code: 'not_found'}, {status: 404}));
    vi.stubGlobal('fetch', fetch);

    await expect(getNewsBySlug('en', 'absent')).rejects.toMatchObject({status: 404});
    expect((fetch.mock.calls[0][0] as Request).url).toBe(daprBase + '/news/absent?locale=en');
  });
});
