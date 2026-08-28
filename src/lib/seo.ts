import type {Metadata} from 'next';
import type {Locale} from '@/i18n/locales';
import {productLocales} from '@/i18n/locales';
import {siteConfig} from './site';

export type LanguageAlternates = Partial<Record<Locale | 'x-default', string>>;

export function getLocalizedPath(locale: Locale, pathname: string) {
  const normalizedPath = pathname === '/' ? '' : pathname;
  return `/${locale}${normalizedPath}`;
}

export function getAlternates(pathname: string, locales: readonly Locale[] = productLocales): LanguageAlternates {
  const alternates: LanguageAlternates = Object.fromEntries(
    locales.map((locale) => [locale, `${siteConfig.url}${getLocalizedPath(locale, pathname)}`])
  );

  if (pathname === '/') alternates['x-default'] = `${siteConfig.url}/`;
  return alternates;
}

export function getOpenGraphLocale(locale: Locale) {
  const map: Record<Locale, string> = {
    'zh-Hant': 'zh_TW',
    'zh-Hans': 'zh_CN',
    en: 'en_US',
    ja: 'ja_JP',
    ko: 'ko_KR'
  };

  return map[locale];
}

export function getEditorialMetadata({locale, path, title, socialTitle = title, description, siteName, availableLocales, indexable}: {
  locale: Locale;
  path: string;
  title: string;
  socialTitle?: string;
  description: string;
  siteName: string;
  availableLocales: readonly Locale[];
  indexable: boolean;
}): Metadata {
  const indexedLocales = indexable ? availableLocales : [];
  return {
    title,
    description,
    alternates: indexable ? {canonical: getLocalizedPath(locale, path), languages: getAlternates(path, availableLocales)} : undefined,
    robots: indexable ? undefined : {index: false, follow: true},
    openGraph: {
      title: socialTitle,
      description,
      locale: getOpenGraphLocale(locale),
      alternateLocale: indexedLocales.filter((value) => value !== locale).map(getOpenGraphLocale),
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      siteName,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {card: 'summary_large_image', title: socialTitle, description, images: [siteConfig.defaultOgImage]}
  };
}
