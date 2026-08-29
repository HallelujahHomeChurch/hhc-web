import type {SiteLayout} from '@/features/site-layout/types';
import {siteConfig} from './site';

export const organizationId = 'https://www.alive.org.tw/#organization';

export function organizationStructuredData(links: SiteLayout['links']) {
  return {
    '@type': 'Organization',
    '@id': organizationId,
    name: 'HHC',
    alternateName: [
      '哈利路亞家教會',
      '哈利路亚家教会',
      'Hallelujah Home Church',
      'ハレルヤ・ホームチャーチ',
      '할렐루야 가정교회'
    ],
    url: `${siteConfig.url}/`,
    logo: `${siteConfig.url}/assets/brand/logo.png`,
    sameAs: [links.churchYoutube, links.churchFacebook]
  } as const;
}

export function normalizeMetaDescription(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function toAbsoluteHttpsUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value, `${siteConfig.url}/`);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
