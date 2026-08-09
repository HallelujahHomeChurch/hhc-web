import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import {mapNewsItem} from '@/features/news/api';
import {mapVideoItem} from '@/features/videos/api';
import type {Locale} from '@/i18n/locales';

export async function getHomeContent(locale: Locale, client: HhcWebClient = publicContentClient()) {
  const home = await client.getHome(locale);
  return {
    news: home.news.map(mapNewsItem),
    videos: home.videos.map(mapVideoItem)
  };
}
