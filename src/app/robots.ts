import type {MetadataRoute} from 'next';
import {locales} from '@/i18n/locales';
import {siteConfig} from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: locales.map((locale) => `/${locale}/statements/`)
    },
    sitemap: `${siteConfig.url}/sitemap.xml`
  };
}
