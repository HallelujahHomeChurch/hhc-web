import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import RootPage, {dynamic, generateMetadata} from './page';

const request = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  redirect: vi.fn()
}));

vi.mock('@/features/site-layout/api', () => ({getSiteLayout: async () => ({
  locale: 'zh-Hant',
  siteName: 'CMS 中文站',
  englishName: 'CMS English Name',
  copyrightHolder: 'CMS 著作權人',
  allRightsReserved: 'CMS 保留權利',
  seoTitleSuffix: 'CMS SEO 標題',
  seoDescriptionFallback: 'CMS SEO 說明',
  header: [],
  legal: [],
  links: {
    churchYoutube: 'https://youtube.com/@cms-church',
    churchFacebook: 'https://www.facebook.com/cms-church',
    musicYoutube: 'https://youtube.com/@cms-music'
  },
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
})}));

vi.mock('next/headers', () => ({
  headers: async () => ({get: (name: string) => request.headers.get(name) ?? null})
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => request.redirect(path)
}));

describe('RootPage', () => {
  beforeEach(() => {
    request.headers.clear();
    request.redirect.mockReset().mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('renders a crawlable selector for every product locale without a language signal', async () => {
    const markup = renderToStaticMarkup(await RootPage());

    expect(markup).toContain('href="/zh-Hant"');
    expect(markup).toContain('href="/zh-Hans"');
    expect(markup).toContain('href="/en"');
    expect(markup).toContain('href="/ja"');
    expect(markup).toContain('href="/ko"');
    expect(markup).toContain('"@type":"WebSite"');
    expect(markup).toContain('哈利路亚家教会');
    expect(markup).toContain('ハレルヤ・ホームチャーチ');
    expect(markup).toContain('할렐루야 가정교회');
    expect(request.redirect).not.toHaveBeenCalled();
  });

  it('publishes projected root metadata with canonical and x-default links', async () => {
    const metadata = await generateMetadata();

    expect(dynamic).toBe('force-dynamic');
    expect(metadata).toMatchObject({
      title: 'CMS SEO 標題',
      description: 'CMS SEO 說明',
      alternates: {
        canonical: '/',
        languages: {'x-default': 'https://www.alive.org.tw/'}
      },
      openGraph: {siteName: 'CMS 中文站'}
    });
  });

  it('publishes HHC with all localized full names as the website identity', async () => {
    const markup = renderToStaticMarkup(await RootPage());
    const jsonLd = markup.match(
      /<script type="application\/ld\+json">([^<]+)<\/script>/
    )?.[1];

    expect(jsonLd).toBeDefined();
    expect(JSON.parse(jsonLd!)).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'CMS 中文站',
          alternateName: [
            '哈利路亞家教會',
            '哈利路亚家教会',
            'Hallelujah Home Church',
            'ハレルヤ・ホームチャーチ',
            '할렐루야 가정교회'
          ]
        },
        {
          '@type': 'Organization',
          '@id': 'https://www.alive.org.tw/#organization',
          sameAs: ['https://youtube.com/@cms-church', 'https://www.facebook.com/cms-church']
        }
      ]
    });
  });

  it('redirects a Japanese browser to the Japanese home page', async () => {
    request.headers.set('accept-language', 'ja-JP,en;q=0.8');

    await expect(RootPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(request.redirect).toHaveBeenCalledWith('/ja');
  });
});
