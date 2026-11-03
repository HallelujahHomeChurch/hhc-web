import type {Metadata} from 'next';
import {publicContentBaseUrl} from '@/features/content/config';
import type {Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

export const recordingIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

import {videoPublicIdPattern} from './share';
export {videoPublicIdPattern} from './share';

export async function legacyVideoPath(id: string): Promise<string | undefined> {
  if (!recordingIdPattern.test(id)) return;
  const response = await fetch(`${publicContentBaseUrl().replace(/\/$/, '')}/recording-previews/${id}`, {
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) return;
  return response.headers.get('Link')?.match(/^<(\/video\/[A-Za-z0-9_-]{11})>; rel="canonical"$/)?.[1];
}

export function recordingShareMetadata(locale: Locale, id: string): Promise<Metadata> {
  return shareMetadata(locale, id, false);
}
export function videoShareMetadata(id: string): Promise<Metadata> {
  return shareMetadata('zh-Hant', id, true);
}
async function shareMetadata(locale: Locale, id: string, short: boolean): Promise<Metadata> {
  const messages = getMessages(locale);
  let title = messages.memberVideos.selectedTitle;
  let image: string = siteConfig.defaultOgImage;
  const previewPath = `${short ? 'video' : 'recording'}-previews/${id}`;
  if ((short ? videoPublicIdPattern : recordingIdPattern).test(id)) {
    try {
      const response = await fetch(`${publicContentBaseUrl().replace(/\/$/, '')}/${previewPath}`, {
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (typeof body === 'object' && body !== null && 'data' in body &&
          typeof body.data === 'object' && body.data !== null && 'title' in body.data &&
          typeof body.data.title === 'string' && body.data.title.trim() && [...body.data.title].length <= 180) {
          title = body.data.title;
          image = `/api/${previewPath}/cover`;
        }
      }
    } catch {
      // Share-service outages must not prevent the member watch page from loading.
    }
  }
  const description = messages.memberVideos.shareDescription;
  const url = short ? `${siteConfig.url}/video/${id}` : `${siteConfig.url}/${locale}/member-videos/${id}`;
  const imageUrl = new URL(image, siteConfig.url).href;
  return {
    title,
    description,
    robots: {index: false, follow: false, noarchive: true},
    alternates: {canonical: url},
    openGraph: {type: 'website', title, description, url, locale: getOpenGraphLocale(locale), siteName: messages.site.name, images: [{url: imageUrl, alt: title}]},
    twitter: {card: 'summary_large_image', title, description, images: [imageUrl]}
  };
}
