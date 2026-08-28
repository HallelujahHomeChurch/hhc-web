import type {SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import {describe, expect, it, vi} from 'vitest';

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
  it('fetches and injects the exact-locale header projection', async () => {
    getSiteLayout.mockResolvedValue(layout);

    const element = await SiteHeaderServer({locale: 'ja', pathname: '/ja/about'});

    expect(getSiteLayout).toHaveBeenCalledWith('ja');
    expect(element.props).toMatchObject({layout, locale: 'ja', pathname: '/ja/about'});
  });

  it('fetches and injects the exact-locale footer projection', async () => {
    getSiteLayout.mockResolvedValue(layout);

    const element = await SiteFooterServer({locale: 'ja', pathname: '/ja/about'});

    expect(getSiteLayout).toHaveBeenCalledWith('ja');
    expect(element.props).toMatchObject({layout, locale: 'ja', pathname: '/ja/about'});
  });
});
