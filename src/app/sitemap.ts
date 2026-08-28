import type {MetadataRoute} from 'next';
import type {NewsItem} from '@/features/news/types';
import {getNewsPage} from '@/features/news/api';
import {getAboutPage, getHomePage, getLegalPage} from '@/features/pages/api';
import {productLocales, type Locale} from '@/i18n/locales';
import {getAlternates, getLocalizedPath} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

const staticPaths = ['/help/account', '/news', '/literature-ministry'] as const;

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = staticPaths.flatMap((path) =>
    productLocales.map((locale) => ({
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      alternates: {
        languages: getAlternates(path)
      }
    }))
  );
  const fixedPages = await Promise.all([
    fixedPage('/', () => getHomePage('zh-Hant')),
    fixedPage('/about', () => getAboutPage('zh-Hant')),
    fixedPage('/privacy-policy', () => getLegalPage('privacy-policy', 'zh-Hant')),
    fixedPage('/terms-of-use', () => getLegalPage('terms-of-use', 'zh-Hant'))
  ]);
  // ponytail: index the first 100 published items; paginate when the site exceeds that ceiling.
  const news = await getNewsPage('zh-Hant', 1, 100).then((result) => result.items).catch(() => []);
  return [...staticEntries, ...fixedPages.flat(), ...buildNewsSitemap(news)];
}

async function fixedPage(path: string, load: () => Promise<{source: string; indexable: boolean; availableLocales: Locale[]}>): Promise<MetadataRoute.Sitemap> {
  const page = await load().catch(() => null);
  if (!page || page.source !== 'cms' || !page.indexable) return [];
  return page.availableLocales.map((locale) => ({
    url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
    alternates: {languages: getAlternates(path, page.availableLocales)}
  }));
}

export function buildNewsSitemap(news: NewsItem[]): MetadataRoute.Sitemap {
  return news.flatMap((item) => {
    const slug = item.href.split('/').filter(Boolean).at(-1);
    if (!slug) return [];
    const path = `/news/${slug}`;
    return item.availableLocales.map((locale) => ({
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      alternates: {languages: getAlternates(path, item.availableLocales)}
    }));
  });
}
