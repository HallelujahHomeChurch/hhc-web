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
