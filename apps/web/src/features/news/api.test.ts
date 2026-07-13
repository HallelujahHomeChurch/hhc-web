import {describe, expect, it} from 'vitest';
import type {HhcWebClient} from '@hhc/hhc-web-client';
import {getNews} from './api';

describe('getNews', () => {
  it('maps published news projections without using fixtures', async () => {
    const client = {listPublicContent: async () => [{id: 'news-1', title: '消息', summary: '摘要', displayDate: '2026-07-13', imageAlt: '封面', imageUrl: '/api/assets/public/cover/large', href: '/zh-Hant/news/news-1'}]} as unknown as HhcWebClient;
    const [item] = await getNews('zh-Hant', client);

    expect(item).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      date: expect.any(String),
      href: expect.any(String)
    });
    expect(item.imageSrc).toBe('/api/assets/public/cover/large');
  });
});
