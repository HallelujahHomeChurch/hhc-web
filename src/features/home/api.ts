import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import {mapNewsItem} from '@/features/news/api';
import {mapVideoItem} from '@/features/videos/api';
import type {Locale} from '@/i18n/locales';
import {captureHandledError} from '@/lib/observability';

export async function getHomeContent(locale: Locale, client: HhcWebClient = publicContentClient()) {
  try {
    const home = await client.getHome(locale);
    return {
      news: home.news.map((value) => mapNewsItem(value, locale)),
      videos: home.videos.map((value) => mapVideoItem(value, locale)),
      newsFailed: false,
      videosFailed: false
    };
  } catch (error) {
    captureHandledError(error, {operation: 'home.content', tags: {locale}});
    return {news: [], videos: [], newsFailed: true, videosFailed: true};
  }
}
