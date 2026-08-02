import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import type {VideoItem} from './types';

export async function getVideos(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<VideoItem[]> {
  const {videos: values} = await client.getHome(locale);
  return values.map((value) => ({
    id: value.id,
    title: value.title,
    imageSrc: `https://i.ytimg.com/vi/${value.youtubeVideoId}/hqdefault.jpg`,
    imageAlt: value.imageAlt ?? value.title,
    href: value.href ?? `https://www.youtube.com/watch?v=${value.youtubeVideoId}`
  }));
}
