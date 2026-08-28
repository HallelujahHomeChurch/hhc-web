import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath} from '@/lib/seo';
import {getHomePageTitle} from '@/lib/home-metadata';

const mocks = vi.hoisted(() => ({
  getHomePage: vi.fn(),
  getHomeContent: vi.fn(),
  getLocations: vi.fn(),
  getSiteLayout: vi.fn()
}));

vi.mock('@/features/pages/api', () => ({getHomePage: mocks.getHomePage}));
vi.mock('@/features/home/api', () => ({getHomeContent: mocks.getHomeContent}));
vi.mock('@/features/locations/api', () => ({getLocations: mocks.getLocations}));
vi.mock('@/features/site-layout/api', () => ({getSiteLayout: mocks.getSiteLayout}));
vi.mock('@/components/layout/SiteHeader', () => ({SiteHeader: () => null}));
vi.mock('@/components/layout/SiteFooter', () => ({SiteFooter: () => null}));
vi.mock('@/components/layout/SiteHeaderServer', () => ({SiteHeaderServer: () => null}));
vi.mock('@/components/layout/SiteFooterServer', () => ({SiteFooterServer: () => null}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));

import HomePage, {generateMetadata} from './page';

describe('home page metadata', () => {
  it('uses only the site name as the browser title', async () => {
    expect(getHomePageTitle('zh-Hant')).toBe('哈利路亞家教會');
    expect(getHomePageTitle('ja')).toBe('ハレルヤ・ホームチャーチ');
    expect(getHomePageTitle('ko')).toBe('할렐루야 가정교회');
  });

  it('provides localized metadata and static alternates for Japanese and Korean', () => {
    expect(getMessages('ja').home.heroSubtitle).toBe('愛の中で家庭を築き、真理の中で成長する');
    expect(getMessages('ko').home.heroSubtitle).toBe('사랑으로 가정을 세우고 진리 안에서 자라갑니다');
    expect(getLocalizedPath('ja', '/privacy-policy')).toBe('/ja/privacy-policy');
    expect(getAlternates('/terms-of-use')).toMatchObject({
      ja: 'https://www.alive.org.tw/ja/terms-of-use',
      ko: 'https://www.alive.org.tw/ko/terms-of-use'
    });
  });

  it('uses the projected music channel for the home video CTA', async () => {
    mocks.getHomePage.mockResolvedValue(cmsHomePage());
    mocks.getHomeContent.mockResolvedValue({news: [], newsFailed: false, videos: [], videosFailed: false});
    mocks.getLocations.mockResolvedValue([]);
    mocks.getSiteLayout.mockResolvedValue({links: {musicYoutube: 'https://youtube.com/@cms-music'}});

    const markup = renderToStaticMarkup(await HomePage({params: Promise.resolve({locale: 'ja'})}));

    expect(markup).toContain('href="https://youtube.com/@cms-music"');
    expect(markup).toContain('CMS Home hero');
    expect(markup).toContain('CMS News heading');
    expect(markup).toContain('CMS Weekly heading');
    expect(markup).toContain('CMS Videos heading');
    expect(markup).toContain('CMS About heading');
    expect(markup).toContain('CMS Locations heading');
    expect(markup).not.toContain('data-cms-fallback');
    expect(mocks.getHomeContent).toHaveBeenCalledWith('ja');
    expect(mocks.getLocations).toHaveBeenCalledWith('ja');
  });

  it('marks only migration-fallback Home output for the live observation gate', async () => {
    mocks.getHomePage.mockResolvedValue({...cmsHomePage(), source: 'migration-fallback'});
    mocks.getHomeContent.mockResolvedValue({news: [], newsFailed: false, videos: [], videosFailed: false});
    mocks.getLocations.mockResolvedValue([]);
    mocks.getSiteLayout.mockResolvedValue({links: {musicYoutube: 'https://youtube.com/@cms-music'}});

    const markup = renderToStaticMarkup(await HomePage({params: Promise.resolve({locale: 'ja'})}));

    expect(markup).toContain('<main data-cms-fallback="home">');
  });

  it('uses CMS copy and published locale membership for metadata', async () => {
    mocks.getHomePage.mockResolvedValue(cmsHomePage());
    mocks.getSiteLayout.mockResolvedValue({seoTitleSuffix: 'CMS SEO', seoDescriptionFallback: 'Layout fallback', siteName: 'CMS Site'});

    const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja'})});

    expect(metadata.description).toBe('CMS Home subtitle');
    expect(metadata.alternates?.languages).toEqual({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant',
      ja: 'https://www.alive.org.tw/ja',
      'x-default': 'https://www.alive.org.tw/'
    });
    expect(metadata.openGraph).toMatchObject({title: 'CMS SEO | CMS Home hero', alternateLocale: ['zh_TW']});
  });
});

function cmsHomePage() {
  return {source: 'cms', indexable: true, availableLocales: ['zh-Hant', 'ja'], content: {
    heroTitle: 'CMS Home hero', heroSubtitle: 'CMS Home subtitle', newsTitle: 'CMS News heading', moreNews: 'CMS More news',
    weeklyTitle: 'CMS Weekly heading', downloadWeekly: 'CMS Download', videosTitle: 'CMS Videos heading', videosSubtitle: 'CMS Videos subtitle',
    watchMore: 'CMS Watch more', aboutTitle: 'CMS About heading', aboutBody: 'CMS About body', aboutCta: 'CMS About CTA',
    locationsTitle: 'CMS Locations heading', mapLink: 'CMS Map link'
  }};
}
