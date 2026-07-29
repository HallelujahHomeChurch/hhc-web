import type {MetadataRoute} from 'next';
import {locales} from '@/i18n/locales';
import {getAlternates, getLocalizedPath} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

const paths = ['/', '/about', '/literature-ministry', '/privacy-policy', '/terms-of-use'] as const;

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      lastModified: new Date('2026-06-26'),
      alternates: {
        languages: getAlternates(path)
      }
    }))
  );
}
