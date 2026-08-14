import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import {formatContentDate, getContentLocaleMetadata} from '@/features/content/locale';
import type {Locale} from '@/i18n/locales';
import type {NewsDetail, NewsItem, NewsPage} from './types';

export async function getNews(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<NewsItem[]> {
  const values = await client.listPublicContent('news', locale);
  return values.map((value) => mapNewsItem(value, locale));
}

export async function getNewsPage(locale: Locale, page: number, pageSize: number, client: HhcWebClient = publicContentClient()): Promise<NewsPage> {
  const result = await client.listPublicContentPage('news', locale, {page, pageSize});
  return {items: result.data.map((value) => mapNewsItem(value, locale)), meta: result.meta};
}

export function mapNewsItem(value: Awaited<ReturnType<HhcWebClient['listPublicContent']>>[number], requestedLocale: Locale): NewsItem {
  const metadata = getContentLocaleMetadata(requestedLocale, value);
  return {
    ...metadata,
    id: value.id,
    title: value.title,
    summary: value.summary ?? '',
    date: formatContentDate(value.displayDate ?? '', metadata.resolvedLocale),
    imageAlt: value.imageAlt ?? value.title,
    imageSrc: value.homeImageUrl ?? value.imageUrl,
    href: value.href ?? '#'
  };
}

export async function getNewsBySlug(locale: Locale, slug: string, client: HhcWebClient = publicContentClient()): Promise<NewsDetail> {
  const value = await client.getNewsBySlug(locale, slug);
  const metadata = getContentLocaleMetadata(locale, value);
  return {
    ...metadata,
    id: value.id,
    title: value.title,
    summary: value.summary ?? '',
    body: value.body ?? '',
    date: formatContentDate(value.displayDate ?? '', metadata.resolvedLocale),
    displayDate: value.displayDate ?? '',
    authorName: value.authorName ?? '',
    firstPublishedAt: value.firstPublishedAt,
    lastPublishedAt: value.lastPublishedAt,
    imageAlt: value.imageAlt ?? value.title,
    imageSrc: value.imageUrl,
    layout: value.detailLayout ?? 'top',
    href: value.href ?? `/${locale}/news/${slug}`
  };
}
