import {describe, expect, it, vi} from 'vitest';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getHomeContent} from './api';

describe('getHomeContent', () => {
  it('keeps videos when news fails', async () => {
    const listPublicContent = vi.fn().mockImplementation((module: string) => module === 'news'
      ? Promise.reject(new Error('news unavailable'))
      : Promise.resolve([{
          id: 'video-1',
          title: '影片',
          resolvedLocale: 'zh-Hant',
          availableLocales: ['zh-Hant'],
          youtubeVideoId: 'K3ckFWeSQ-k',
          homeEligible: true
        }]));
    const client = {listPublicContent} as unknown as HhcWebClient;

    const content = await getHomeContent('ja', client);

    expect(content.news).toEqual([]);
    expect(content.newsFailed).toBe(true);
    expect(content.videosFailed).toBe(false);
    expect(content.videos).toEqual([expect.objectContaining({
      title: '影片',
      requestedLocale: 'ja',
      resolvedLocale: 'zh-Hant'
    })]);
  });

  it('keeps news when videos fail', async () => {
    const listPublicContent = vi.fn().mockImplementation((module: string) => module === 'videos'
      ? Promise.reject(new Error('videos unavailable'))
      : Promise.resolve([{
        id: 'news-1',
        title: '消息',
        resolvedLocale: 'zh-Hant',
        availableLocales: ['zh-Hant', 'en'],
        displayDate: '2026-08-09',
        homeImageUrl: '/assets/news-home',
        imageUrl: '/assets/news-detail',
        href: '/ja/news/news-1'
      }]));
    const client = {listPublicContent} as unknown as HhcWebClient;

    const content = await getHomeContent('ja', client);

    expect(listPublicContent).toHaveBeenCalledTimes(2);
    expect(content.newsFailed).toBe(false);
    expect(content.videosFailed).toBe(true);
    expect(content.news).toEqual([expect.objectContaining({
      title: '消息',
      date: '2026年8月9日',
      imageSrc: '/assets/news-home',
      href: '/ja/news/news-1',
      requestedLocale: 'ja',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en']
    })]);
    expect(content.videos).toEqual([]);
  });
});
