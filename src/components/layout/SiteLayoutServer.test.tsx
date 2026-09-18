import type {SiteLayout} from '@/features/site-layout/types';
import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import type {Locale} from '@/i18n/locales';

const getSiteLayout = vi.hoisted(() => vi.fn());
vi.mock('@/features/site-layout/api', () => ({getSiteLayout}));

import {SiteFooterServer} from './SiteFooterServer';
import {SiteHeaderServer} from './SiteHeaderServer';

const layout = {
  locale: 'ja',
  siteName: 'CMS 公開サイト名',
  englishName: 'CMS English Name',
  copyrightHolder: 'CMS 著作権者',
  allRightsReserved: 'CMS Rights',
  seoTitleSuffix: 'CMS SEO サフィックス',
  seoDescriptionFallback: 'CMS SEO 説明',
  header: [],
  legal: [],
  links: {
    churchYoutube: 'https://youtube.com/@cms-church',
    churchFacebook: 'https://www.facebook.com/cms-church',
    musicYoutube: 'https://youtube.com/@cms-music'
  },
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
} satisfies SiteLayout;

describe('site layout server wrappers', () => {
  it('exposes only route-owned props at the server header boundary', () => {
    expectTypeOf<Parameters<typeof SiteHeaderServer>[0]>().toEqualTypeOf<{
      locale: Locale;
      pathname: string;
    }>();
  });

  it('fetches and injects the exact-locale header projection', async () => {
    getSiteLayout.mockResolvedValue(layout);

    const element = await SiteHeaderServer({locale: 'ja', pathname: '/ja/about'});

    expect(getSiteLayout).toHaveBeenCalledWith('ja');
    expect(element.props).toMatchObject({layout, locale: 'ja', pathname: '/ja/about'});
    expect(Object.keys(element.props).sort()).toEqual(['layout', 'locale', 'pathname']);
  });

  it('fetches and injects the exact-locale footer projection', async () => {
    getSiteLayout.mockResolvedValue(layout);

    const element = await SiteFooterServer({locale: 'ja', pathname: '/ja/about'});

    expect(getSiteLayout).toHaveBeenCalledWith('ja');
    expect(element.props).toMatchObject({layout, locale: 'ja', pathname: '/ja/about'});
  });
});
