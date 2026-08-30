import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach, describe, expect, it, vi} from 'vitest';
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

beforeEach(() => vi.clearAllMocks());

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

  it('renders Home v2 aggregate data without standalone Locations and keeps labels in i18n', async () => {
    mocks.getHomePage.mockResolvedValue(cmsHomeV2Page());
    mocks.getHomeContent.mockResolvedValue({news: [], newsFailed: false, videos: [], videosFailed: false});
    mocks.getSiteLayout.mockResolvedValue({links: cmsHomeV2Page().content.links});

    const markup = renderToStaticMarkup(await HomePage({params: Promise.resolve({locale: 'en'})}));

    expect(markup).toContain('V2 Home hero');
    expect(markup).toContain('V2 Home subtitle');
    expect(markup).toContain('V2 Kingdom Joy description');
    expect(markup).toContain('V2 About description');
    expect(markup).toContain('Taipei Home Church');
    expect(markup).toContain('Taipei address');
    expect(markup).toContain('Latest News');
    expect(markup).toContain('Weekly Paper');
    expect(markup).toContain('Kingdom Joy');
    expect(markup).toContain('About Us');
    expect(markup).toContain('Locations');
    expect(markup).toContain('%2Fapi%2Fassets%2Fhome-banner%2Foriginal');
    expect(mocks.getLocations).not.toHaveBeenCalled();
    expect(mocks.getHomeContent).toHaveBeenCalledWith('en');
  });

  it('renders the backend-selected Home arrays in order', async () => {
    mocks.getHomePage.mockResolvedValue(cmsHomeV2Page());
    mocks.getHomeContent.mockResolvedValue({
      news: ['A', 'B', 'C', 'D'].map((title, index) => ({
        id: String(index + 1),
        title: `News ${title}`,
        summary: '',
        date: '2026-08-31',
        imageAlt: `News ${title}`,
        href: `/en/news/${index + 1}`,
        requestedLocale: 'en',
        resolvedLocale: 'en',
        availableLocales: ['en']
      })),
      newsFailed: false,
      videosFailed: false,
      videos: ['A', 'B', 'C'].map((title, index) => ({
        id: String(index + 1),
        title: `Video ${title}`,
        imageSrc: `https://i.ytimg.com/vi/${index + 1}/hqdefault.jpg`,
        imageAlt: `Video ${title}`,
        href: `https://www.youtube.com/watch?v=${index + 1}`,
        requestedLocale: 'en',
        resolvedLocale: 'en',
        availableLocales: ['en']
      }))
    });
    mocks.getSiteLayout.mockResolvedValue({links: cmsHomeV2Page().content.links});

    const markup = renderToStaticMarkup(await HomePage({params: Promise.resolve({locale: 'en'})}));

    expect(markup).toContain('News D');
    expect(markup.indexOf('Video A')).toBeLessThan(markup.indexOf('Video B'));
    expect(markup.indexOf('Video B')).toBeLessThan(markup.indexOf('Video C'));
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

function cmsHomeV2Page() {
  return {template: 'home.v2', source: 'cms', indexable: true, availableLocales: ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'], content: {
    heroTitle: 'V2 Home hero', heroSubtitle: 'V2 Home subtitle', kingdomJoyDescription: 'V2 Kingdom Joy description', aboutDescription: 'V2 About description',
    bannerImageUrl: '/api/assets/home-banner/original',
    links: {churchYoutube: 'https://youtube.com/@v2-church', churchFacebook: 'https://facebook.com/v2-church', musicYoutube: 'https://youtube.com/@v2-music'},
    locations: [{key: 'taipei', name: 'Taipei Home Church', address: 'Taipei address', mapHref: 'https://maps.example/taipei', sortOrder: 10}]
  }};
}
