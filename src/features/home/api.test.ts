import {describe, expect, it, vi} from 'vitest';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getHomeContent} from './api';

describe('getHomeContent', () => {
  it('maps news and videos from one home projection request', async () => {
    const getHome = vi.fn().mockResolvedValue({
      news: [{
        id: 'news-1',
        title: '消息',
        resolvedLocale: 'zh-Hant',
        availableLocales: ['zh-Hant', 'en'],
        displayDate: '2026-08-09',
        homeImageUrl: '/assets/news-home',
        imageUrl: '/assets/news-detail',
        href: '/ja/news/news-1'
      }],
      videos: [{
        id: 'video-1',
        title: '影片',
        resolvedLocale: 'zh-Hant',
        availableLocales: ['zh-Hant'],
        youtubeVideoId: 'K3ckFWeSQ-k'
      }]
    });
    const client = {getHome} as unknown as HhcWebClient;

    const content = await getHomeContent('ja', client);

    expect(getHome).toHaveBeenCalledTimes(1);
    expect(content.news).toEqual([expect.objectContaining({
      title: '消息',
      date: '2026年8月9日',
      imageSrc: '/assets/news-home',
      href: '/ja/news/news-1',
      requestedLocale: 'ja',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en']
    })]);
    expect(content.videos).toEqual([expect.objectContaining({
      title: '影片',
      imageSrc: 'https://i.ytimg.com/vi/K3ckFWeSQ-k/hqdefault.jpg',
      href: 'https://www.youtube.com/watch?v=K3ckFWeSQ-k',
      requestedLocale: 'ja',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant']
    })]);
  });
});
