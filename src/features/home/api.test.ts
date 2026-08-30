import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {describe, expect, it, vi} from 'vitest';
import {getHomeContent} from './api';

describe('getHomeContent', () => {
  it('uses the backend Home selection without slicing videos', async () => {
    const getHome = vi.fn().mockResolvedValue({
      news: [{
        id: 'news-1',
        title: '消息',
        resolvedLocale: 'zh-Hant',
        availableLocales: ['zh-Hant', 'en'],
        displayDate: '2026-08-09',
        homeImageUrl: '/assets/news-home',
        href: '/ja/news/news-1'
      }],
      videos: ['c', 'a', 'd', 'b'].map((id) => ({
        id,
        title: `影片 ${id}`,
        resolvedLocale: 'zh-Hant',
        availableLocales: ['zh-Hant'],
        youtubeVideoId: `youtube-${id}`,
        homeEligible: id !== 'a'
      }))
    });
    const listPublicContent = vi.fn();

    const content = await getHomeContent('ja', {getHome, listPublicContent} as unknown as HhcWebClient);

    expect(getHome).toHaveBeenCalledWith('ja');
    expect(getHome).toHaveBeenCalledTimes(1);
    expect(listPublicContent).not.toHaveBeenCalled();
    expect(content.news).toEqual([expect.objectContaining({id: 'news-1', title: '消息'})]);
    expect(content.videos.map((item) => item.id)).toEqual(['c', 'a', 'd', 'b']);
    expect(content.newsFailed).toBe(false);
    expect(content.videosFailed).toBe(false);
  });

  it('marks both sections failed when the Home endpoint fails', async () => {
    const getHome = vi.fn().mockRejectedValue(new Error('home unavailable'));
    const listPublicContent = vi.fn();

    const content = await getHomeContent('en', {getHome, listPublicContent} as unknown as HhcWebClient);

    expect(getHome).toHaveBeenCalledWith('en');
    expect(getHome).toHaveBeenCalledTimes(1);
    expect(listPublicContent).not.toHaveBeenCalled();
    expect(content).toEqual({news: [], videos: [], newsFailed: true, videosFailed: true});
  });
});
