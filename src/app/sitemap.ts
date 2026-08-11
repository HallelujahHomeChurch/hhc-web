import type {MetadataRoute} from 'next';
import type {NewsItem} from '@/features/news/types';
import {getNewsPage} from '@/features/news/api';
import {productLocales} from '@/i18n/locales';
import {getAlternates, getLocalizedPath} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

const paths = ['/', '/about', '/help/account', '/news', '/literature-ministry', '/privacy-policy', '/terms-of-use'] as const;

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = paths.flatMap((path) =>
    productLocales.map((locale) => ({
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      alternates: {
        languages: getAlternates(path)
      }
    }))
  );
  // ponytail: index the first 100 published items; paginate when the site exceeds that ceiling.
  const news = await getNewsPage('zh-Hant', 1, 100).then((result) => result.items).catch(() => []);
  return [...staticEntries, ...buildNewsSitemap(news)];
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
