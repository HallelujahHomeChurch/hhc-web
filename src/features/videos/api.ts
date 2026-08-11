import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getContentLocaleMetadata} from '@/features/content/locale';
import type {Locale} from '@/i18n/locales';
import type {VideoItem} from './types';

export function mapVideoItem(value: Awaited<ReturnType<HhcWebClient['getHome']>>['videos'][number], requestedLocale: Locale): VideoItem {
  return {
    ...getContentLocaleMetadata(requestedLocale, value),
    id: value.id,
    title: value.title,
    imageSrc: `https://i.ytimg.com/vi/${value.youtubeVideoId}/hqdefault.jpg`,
    imageAlt: value.imageAlt ?? value.title,
    href: value.href ?? `https://www.youtube.com/watch?v=${value.youtubeVideoId}`
  };
}
