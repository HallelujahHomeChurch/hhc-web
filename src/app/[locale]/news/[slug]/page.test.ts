import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';

const {getNewsBySlug, getNewsPage} = vi.hoisted(() => ({getNewsBySlug: vi.fn(), getNewsPage: vi.fn()}));

vi.mock('@/features/news/api', () => ({getNewsBySlug, getNewsPage}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));
vi.mock('@/components/layout/SiteHeader', () => ({SiteHeader: () => null}));
vi.mock('@/components/layout/SiteFooter', () => ({SiteFooter: () => null}));

import NewsDetailPage, {generateMetadata} from './page';

const japaneseNews = {
  id: 'current',
  title: 'お知らせ',
  summary: '  概要\n です。 ',
  body: '本文',
  date: '2026年8月11日',
  displayDate: '2026-08-11',
  authorName: 'Pastor Wang',
  firstPublishedAt: '2026-08-14T01:00:00Z',
  lastPublishedAt: '2026-08-14T02:00:00Z',
  imageAlt: 'カバー',
  imageSrc: '/assets/news.jpg',
  href: '/ja/news/current',
  layout: 'top' as const,
  requestedLocale: 'ja' as const,
  resolvedLocale: 'ja' as const,
  availableLocales: ['zh-Hant' as const, 'ja' as const]
};

describe('news detail metadata', () => {
  it('uses the resolved locale and only exact available translations', async () => {
    getNewsBySlug.mockResolvedValue({
      id: 'news-1',
      title: '消息',
      summary: '摘要',
      body: '內容',
      date: '2026 / 08 / 11',
      imageAlt: '封面',
      href: '/zh-Hant/news/announcement',
      layout: 'top',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en']
    });

    const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja', slug: 'announcement'})});

    expect(metadata.alternates).toEqual({
      canonical: '/zh-Hant/news/announcement',
      languages: {
        'zh-Hant': 'https://www.alive.org.tw/zh-Hant/news/announcement',
        en: 'https://www.alive.org.tw/en/news/announcement'
      }
    });
    expect(metadata.openGraph).toMatchObject({
      locale: 'zh_TW',
      url: 'https://www.alive.org.tw/zh-Hant/news/announcement'
    });
  });

  it('keeps requested-locale metadata fallbacks when content resolves to another locale', async () => {
    getNewsBySlug.mockResolvedValue({
      ...japaneseNews,
      title: '消息',
      summary: '   ',
      imageAlt: '',
      resolvedLocale: 'zh-Hant'
    });

    const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja', slug: 'announcement'})});

    expect(metadata.title).toBe('消息 | ハレルヤ・ホームチャーチ');
    expect(metadata.description).toBe('ハレルヤ・ホームチャーチからの最新情報やイベントのお知らせをご覧いただけます。');
    expect(metadata.openGraph).toMatchObject({images: [expect.objectContaining({alt: 'ハレルヤ・ホームチャーチ'})]});
  });

  it('uses exact Japanese canonical and hreflang as soon as that projection exists', async () => {
    getNewsBySlug.mockResolvedValue({...japaneseNews, id: 'news-1', href: '/ja/news/announcement'});

    const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja', slug: 'announcement'})});

    expect(metadata.alternates).toEqual({
      canonical: '/ja/news/announcement',
      languages: {
        'zh-Hant': 'https://www.alive.org.tw/zh-Hant/news/announcement',
        ja: 'https://www.alive.org.tw/ja/news/announcement'
      }
    });
    expect(metadata.openGraph).toMatchObject({
      locale: 'ja_JP',
      url: 'https://www.alive.org.tw/ja/news/announcement',
      description: '概要 です。'
    });
  });

  it('renders localized article structured data and three newest sibling links', async () => {
    getNewsBySlug.mockResolvedValue(japaneseNews);
    getNewsPage.mockResolvedValue({
      items: [japaneseNews, ...['a', 'b', 'c'].map((id) => ({...japaneseNews, id, title: id.toUpperCase(), href: `/ja/news/${id}`}))],
      meta: {page: 1, pageSize: 4, total: 4}
    });

    const markup = renderToStaticMarkup(await NewsDetailPage({params: Promise.resolve({locale: 'ja', slug: 'current'})}));
    const jsonLd = markup.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
    const graph = JSON.parse(jsonLd!)['@graph'];

    expect(getNewsPage).toHaveBeenCalledWith('ja', 1, 4);
    expect(graph).toEqual(expect.arrayContaining([
      expect.objectContaining({
        '@type': 'NewsArticle',
        mainEntityOfPage: 'https://www.alive.org.tw/ja/news/current',
        inLanguage: 'ja',
        datePublished: '2026-08-14T01:00:00Z',
        dateModified: '2026-08-14T02:00:00Z',
        author: {'@type': 'Person', name: 'Pastor Wang'},
        publisher: {'@id': 'https://www.alive.org.tw/#organization'}
      }),
      expect.objectContaining({
        '@type': 'BreadcrumbList',
        itemListElement: [
          expect.objectContaining({position: 1, name: 'ホーム', item: 'https://www.alive.org.tw/ja'}),
          expect.objectContaining({position: 2, name: 'お知らせ', item: 'https://www.alive.org.tw/ja/news'}),
          expect.objectContaining({position: 3, name: 'お知らせ', item: 'https://www.alive.org.tw/ja/news/current'})
        ]
      })
    ]));
    expect(markup).not.toContain('href="/ja/news/current"');
    for (const href of ['/ja/news/a', '/ja/news/b', '/ja/news/c']) expect(markup).toContain(`href="${href}"`);
  });

  it('falls back to the organization author, omits equal dateModified, and keeps rendering when recent news fails', async () => {
    getNewsBySlug.mockResolvedValue({...japaneseNews, authorName: '', lastPublishedAt: japaneseNews.firstPublishedAt});
    getNewsPage.mockRejectedValue(new Error('temporary failure'));

    const markup = renderToStaticMarkup(await NewsDetailPage({params: Promise.resolve({locale: 'ja', slug: 'current'})}));
    const jsonLd = markup.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
    const article = JSON.parse(jsonLd!)['@graph'].find((entry: {'@type': string}) => entry['@type'] === 'NewsArticle');

    expect(article.author).toEqual({'@id': 'https://www.alive.org.tw/#organization'});
    expect(article).not.toHaveProperty('dateModified');
    expect(markup).toContain('本文');
    expect(markup).not.toContain('<h2');
  });

  it('omits invalid optional structured-data dates and non-HTTPS images', async () => {
    getNewsBySlug.mockResolvedValue({...japaneseNews, imageSrc: 'http://example.com/news.jpg', firstPublishedAt: 'invalid', lastPublishedAt: 'also-invalid'});
    getNewsPage.mockResolvedValue({items: [], meta: {page: 1, pageSize: 4, total: 0}});

    const markup = renderToStaticMarkup(await NewsDetailPage({params: Promise.resolve({locale: 'ja', slug: 'current'})}));
    const jsonLd = markup.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
    const article = JSON.parse(jsonLd!)['@graph'].find((entry: {'@type': string}) => entry['@type'] === 'NewsArticle');

    expect(article).not.toHaveProperty('image');
    expect(article).not.toHaveProperty('datePublished');
    expect(article).not.toHaveProperty('dateModified');
  });
});
