import type {HhcWebClient} from '@hhc/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import type {VideoItem} from './types';

export async function getVideos(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<VideoItem[]> {
  const values = await client.listPublicContent('videos', locale);
  return values.map((value) => ({
    id: value.id,
    title: value.title,
    imageSrc: value.imageUrl ?? `https://img.youtube.com/vi/${value.youtubeVideoId}/maxresdefault.jpg`,
    imageAlt: value.imageAlt ?? value.title,
    href: value.href ?? `https://www.youtube.com/watch?v=${value.youtubeVideoId}`
  }));
}
