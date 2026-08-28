import type {HhcWebClient, SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import {describe, expect, it, vi} from 'vitest';
import {getSiteLayout} from './api';

const publishedLayout: SiteLayout = {
  locale: 'ja',
  siteName: '公開サイト名',
  englishName: 'Published English Name',
  copyrightHolder: '公開著作権者',
  allRightsReserved: '公開権利表記',
  seoTitleSuffix: '公開SEO名',
  seoDescriptionFallback: '公開SEO説明',
  header: [
    {key: 'about', label: '公開紹介', href: '/ja/about', visible: true},
    {key: 'news', label: '非表示ニュース', href: '/ja/news', visible: false}
  ],
  legal: [
    {key: 'privacy-policy', label: '公開プライバシー', href: '/ja/privacy-policy', visible: true},
    {key: 'terms-of-use', label: '非表示規約', href: '/ja/terms-of-use', visible: false}
  ],
  links: {
    churchYoutube: 'https://youtube.com/@published-church',
    churchFacebook: 'https://www.facebook.com/published-church',
    musicYoutube: 'https://youtube.com/@published-music'
  },
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
};

describe('getSiteLayout', () => {
  it('returns the exact requested-locale public projection', async () => {
    const request = vi.fn().mockResolvedValue(publishedLayout);
    const client = {getSiteLayout: request} as unknown as HhcWebClient;

    await expect(getSiteLayout('ja', client)).resolves.toEqual(publishedLayout);
    expect(request).toHaveBeenCalledWith('ja');
  });

  it.each([
    ['zh-Hant', '哈利路亞家教會', '在愛中建造家庭，在真理中成長'],
    ['zh-Hans', '哈利路亚家教会', '在爱中建造家庭，在真理中成长'],
    ['en', 'Hallelujah Home Church', 'Building families in love and growing in truth'],
    ['ja', 'ハレルヤ・ホームチャーチ', '愛の中で家庭を築き、真理の中で成長する'],
    ['ko', '할렐루야 가정교회', '사랑으로 가정을 세우고 진리 안에서 자라갑니다']
  ] as const)('uses the current exact %s editorial fallback only when the request fails', async (locale, siteName, description) => {
    const client = {getSiteLayout: async () => Promise.reject(new Error('unavailable'))} as unknown as HhcWebClient;

    await expect(getSiteLayout(locale, client)).resolves.toMatchObject({
      locale,
      siteName,
      seoTitleSuffix: siteName,
      seoDescriptionFallback: description,
      header: [
        expect.objectContaining({key: 'about', visible: true}),
        expect.objectContaining({key: 'news', visible: true}),
        expect.objectContaining({key: 'literature-ministry', visible: true})
      ],
      legal: [
        expect.objectContaining({key: 'privacy-policy', visible: true}),
        expect.objectContaining({key: 'terms-of-use', visible: true})
      ],
      links: {
        churchYoutube: 'https://youtube.com/@hhc33?si=SR2rSIVOTFX2dCmw',
        churchFacebook: 'https://www.facebook.com/www.alive.org.tw/?locale=zh_TW',
        musicYoutube: 'https://youtube.com/@gkpmusic777?si=JqJyfjM8FCmWD5MY'
      }
    });
  });

  it('preserves the complete current Traditional Chinese editorial fallback', async () => {
    const client = {getSiteLayout: async () => Promise.reject(new Error('unavailable'))} as unknown as HhcWebClient;

    await expect(getSiteLayout('zh-Hant', client)).resolves.toEqual({
      locale: 'zh-Hant',
      siteName: '哈利路亞家教會',
      englishName: 'Hallelujah Home Church',
      copyrightHolder: '社團法人中華民國哈利路亞社區關懷協會',
      allRightsReserved: 'All rights reserved.',
      seoTitleSuffix: '哈利路亞家教會',
      seoDescriptionFallback: '在愛中建造家庭，在真理中成長',
      header: [
        {key: 'about', label: '關於我們', href: '/zh-Hant/about', visible: true},
        {key: 'news', label: '最新消息', href: '/zh-Hant/news', visible: true},
        {key: 'literature-ministry', label: '文字事工', href: '/zh-Hant/literature-ministry', visible: true}
      ],
      legal: [
        {key: 'privacy-policy', label: '隱私權', href: '/zh-Hant/privacy-policy', visible: true},
        {key: 'terms-of-use', label: '條款', href: '/zh-Hant/terms-of-use', visible: true}
      ],
      links: {
        churchYoutube: 'https://youtube.com/@hhc33?si=SR2rSIVOTFX2dCmw',
        churchFacebook: 'https://www.facebook.com/www.alive.org.tw/?locale=zh_TW',
        musicYoutube: 'https://youtube.com/@gkpmusic777?si=JqJyfjM8FCmWD5MY'
      },
      version: 0,
      publishedAt: ''
    });
  });
});
