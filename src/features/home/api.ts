import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import {mapNewsItem} from '@/features/news/api';
import {mapVideoItem} from '@/features/videos/api';
import type {Locale} from '@/i18n/locales';

export async function getHomeContent(locale: Locale, client: HhcWebClient = publicContentClient()) {
  const [news, videos] = await Promise.allSettled([
    client.listPublicContent('news', locale).then((values) => values.slice(0, 3).map((value) => mapNewsItem(value, locale))),
    client.listPublicContent('videos', locale).then((values) => values.filter((value) => value.homeEligible).slice(0, 3).map((value) => mapVideoItem(value, locale)))
  ]);

  return {
    news: news.status === 'fulfilled' ? news.value : [],
    videos: videos.status === 'fulfilled' ? videos.value : [],
    newsFailed: news.status === 'rejected',
    videosFailed: videos.status === 'rejected'
  };
}
