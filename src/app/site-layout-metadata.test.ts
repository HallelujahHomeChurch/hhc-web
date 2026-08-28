import type {SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  getSiteLayout: vi.fn(),
  getNewsBySlug: vi.fn(),
  getHomePage: vi.fn(),
  getAboutPage: vi.fn(),
  getLegalPage: vi.fn()
}));

vi.mock('@/features/site-layout/api', () => ({getSiteLayout: mocks.getSiteLayout}));
vi.mock('@/features/news/api', () => ({getNewsBySlug: mocks.getNewsBySlug}));
vi.mock('@/features/pages/api', () => ({getHomePage: mocks.getHomePage, getAboutPage: mocks.getAboutPage, getLegalPage: mocks.getLegalPage}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));

import {generateMetadata as homeMetadata} from './[locale]/page';
import {generateMetadata as aboutMetadata} from './[locale]/about/page';
import {generateMetadata as accountHelpMetadata} from './[locale]/help/account/page';
import {generateMetadata as literatureMetadata} from './[locale]/literature-ministry/page';
import {generateMetadata as newsMetadata} from './[locale]/news/page';
import {generateMetadata as newsDetailMetadata} from './[locale]/news/[slug]/page';
import {generateMetadata as maintenanceMetadata} from './[locale]/maintenance/page';
import {generateMetadata as unsubscribeMetadata} from './[locale]/newsletter/unsubscribe/page';
import {generateMetadata as privacyMetadata} from './[locale]/privacy-policy/page';
import {generateMetadata as termsMetadata} from './[locale]/terms-of-use/page';

const layout: SiteLayout = {
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
};

describe('localized route metadata site layout', () => {
  beforeEach(() => {
    mocks.getSiteLayout.mockReset().mockResolvedValue(layout);
    mocks.getHomePage.mockReset().mockResolvedValue(page({heroTitle: '愛は家庭から始まる', heroSubtitle: '愛の中で家庭を築き、真理の中で成長する'}));
    mocks.getAboutPage.mockReset().mockResolvedValue(page({heroTitle: '私たちについて', heroSubtitle: '教会のビジョンと歩み'}));
    mocks.getLegalPage.mockReset().mockImplementation((key: string) => Promise.resolve(page(key === 'privacy-policy'
      ? {heroTitle: 'プライバシーポリシー', heroSubtitle: '', intro: 'プライバシー'}
      : {heroTitle: '利用規約', heroSubtitle: '', intro: '利用規約'})));
    mocks.getNewsBySlug.mockReset().mockResolvedValue({
      id: 'news-1',
      title: 'CMS記事',
      summary: '',
      body: '本文',
      date: '2026年8月29日',
      imageAlt: '',
      href: '/ja/news/cms-news',
      layout: 'top',
      requestedLocale: 'ja',
      resolvedLocale: 'ja',
      availableLocales: ['ja']
    });
  });

  it.each([
    ['home', () => homeMetadata({params: Promise.resolve({locale: 'ja'})}), 'CMS SEO サフィックス'],
    ['about', () => aboutMetadata({params: Promise.resolve({locale: 'ja'})}), '私たちについて | CMS SEO サフィックス'],
    ['account help', () => accountHelpMetadata({params: Promise.resolve({locale: 'ja'})}), 'HHCアカウント | CMS SEO サフィックス'],
    ['literature ministry', () => literatureMetadata({params: Promise.resolve({locale: 'ja'})}), '文書ミニストリー | CMS SEO サフィックス'],
    ['news', () => newsMetadata({params: Promise.resolve({locale: 'ja'}), searchParams: Promise.resolve({})}), 'お知らせ | CMS SEO サフィックス'],
    ['news detail', () => newsDetailMetadata({params: Promise.resolve({locale: 'ja', slug: 'cms-news'})}), 'CMS記事 | CMS SEO サフィックス'],
    ['maintenance', () => maintenanceMetadata({params: Promise.resolve({locale: 'ja'})}), 'ウェブサイトを更新しています | CMS SEO サフィックス'],
    ['unsubscribe', () => unsubscribeMetadata({params: Promise.resolve({locale: 'ja'})}), 'ニュースレターの配信停止 | CMS SEO サフィックス'],
    ['privacy', () => privacyMetadata({params: Promise.resolve({locale: 'ja'})}), 'プライバシーポリシー | CMS SEO サフィックス'],
    ['terms', () => termsMetadata({params: Promise.resolve({locale: 'ja'})}), '利用規約 | CMS SEO サフィックス']
  ] as const)('uses the requested locale projection for %s', async (_name, generate, title) => {
    const metadata = await generate();

    expect(metadata.title).toBe(title);
    expect(mocks.getSiteLayout).toHaveBeenCalledWith('ja');
    if (metadata.openGraph) expect(metadata.openGraph).toMatchObject({siteName: 'CMS 公開サイト名'});
  });

  it('uses the projected SEO fallback and site name for blank news detail fields', async () => {
    const metadata = await newsDetailMetadata({params: Promise.resolve({locale: 'ja', slug: 'cms-news'})});

    expect(metadata.description).toBe('CMS SEO 説明');
    expect(metadata.openGraph).toMatchObject({
      siteName: 'CMS 公開サイト名',
      images: [expect.objectContaining({alt: 'CMS 公開サイト名'})]
    });
  });

  it('uses the projected suffix throughout home social metadata', async () => {
    const metadata = await homeMetadata({params: Promise.resolve({locale: 'ja'})});

    expect(metadata.openGraph).toMatchObject({title: 'CMS SEO サフィックス | 愛は家庭から始まる'});
    expect(metadata.twitter).toMatchObject({title: 'CMS SEO サフィックス | 愛は家庭から始まる'});
  });
});

function page(content: Record<string, unknown>) {
  return {source: 'cms', indexable: true, availableLocales: ['ja'], content};
}
