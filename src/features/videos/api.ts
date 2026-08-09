import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import type {VideoItem} from './types';

export function mapVideoItem(value: Awaited<ReturnType<HhcWebClient['getHome']>>['videos'][number]): VideoItem {
  return {
    id: value.id,
    title: value.title,
    imageSrc: `https://i.ytimg.com/vi/${value.youtubeVideoId}/hqdefault.jpg`,
    imageAlt: value.imageAlt ?? value.title,
    href: value.href ?? `https://www.youtube.com/watch?v=${value.youtubeVideoId}`
  };
}
