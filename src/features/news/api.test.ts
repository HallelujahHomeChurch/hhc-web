import {describe, expect, it} from 'vitest';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getNews, getNewsBySlug, getNewsPage} from './api';

describe('getNews', () => {
  it('maps published news projections without using fixtures', async () => {
    const client = {listPublicContent: async () => [{id: 'news-1', title: '消息', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en'], summary: '摘要', displayDate: '2026-07-13', imageAlt: '封面', imageUrl: '/assets/detail/large', homeImageUrl: '/assets/home/large', href: '/zh-Hant/news/news-1'}]} as unknown as HhcWebClient;
    const [item] = await getNews('zh-Hant', client);

    expect(item).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      date: expect.any(String),
      href: expect.any(String)
    });
    expect(item.imageSrc).toBe('/assets/home/large');
    expect(item).toMatchObject({resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en']});
  });

  it('maps a news detail without treating its body as markup', async () => {
    const client = {getNewsBySlug: async () => ({id: 'news-1', title: '消息', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en'], body: '<script>alert(1)</script>', detailLayout: 'left', href: '/zh-Hant/news/news-1'})} as unknown as HhcWebClient;

    await expect(getNewsBySlug('zh-Hant', 'news-1', client)).resolves.toMatchObject({
      title: '消息',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en'],
      body: '<script>alert(1)</script>',
      layout: 'left'
    });
  });

  it('keeps public pagination metadata', async () => {
    const client = {listPublicContentPage: async () => ({
      data: [{id: 'news-1', title: '消息'}],
      meta: {page: 2, pageSize: 12, total: 25}
    })} as unknown as HhcWebClient;

    await expect(getNewsPage('zh-Hant', 2, 12, client)).resolves.toMatchObject({
      items: [{title: '消息'}],
      meta: {page: 2, pageSize: 12, total: 25}
    });
  });
});
