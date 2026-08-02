import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import type {NewsDetail, NewsItem, NewsPage} from './types';

export async function getNews(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<NewsItem[]> {
  const values = await client.listPublicContent('news', locale);
  return values.map(mapNewsItem);
}

export async function getNewsPage(locale: Locale, page: number, pageSize: number, client: HhcWebClient = publicContentClient()): Promise<NewsPage> {
  const result = await client.listPublicContentPage('news', locale, {page, pageSize});
  return {items: result.data.map(mapNewsItem), meta: result.meta};
}

export async function getHomeNews(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<NewsItem[]> {
  const home = await client.getHome(locale);
  return home.news.map(mapNewsItem);
}

function mapNewsItem(value: Awaited<ReturnType<HhcWebClient['listPublicContent']>>[number]): NewsItem {
  return {
    id: value.id,
    title: value.title,
    summary: value.summary ?? '',
    date: value.displayDate?.replaceAll('-', ' / ') ?? '',
    imageAlt: value.imageAlt ?? value.title,
    imageSrc: value.imageUrl,
    href: value.href ?? '#'
  };
}

export async function getNewsBySlug(locale: Locale, slug: string, client: HhcWebClient = publicContentClient()): Promise<NewsDetail> {
  const value = await client.getNewsBySlug(locale, slug);
  return {
    id: value.id,
    title: value.title,
    summary: value.summary ?? '',
    body: value.body ?? '',
    date: value.displayDate?.replaceAll('-', ' / ') ?? '',
    imageAlt: value.imageAlt ?? value.title,
    imageSrc: value.imageUrl,
    href: value.href ?? `/${locale}/news/${slug}`
  };
}
