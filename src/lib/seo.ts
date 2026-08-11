import type {Locale} from '@/i18n/locales';
import {productLocales} from '@/i18n/locales';
import {siteConfig} from './site';

export function getLocalizedPath(locale: Locale, pathname: string) {
  const normalizedPath = pathname === '/' ? '' : pathname;
  return `/${locale}${normalizedPath}`;
}

export function getAlternates(pathname: string, locales: readonly Locale[] = productLocales) {
  return Object.fromEntries(
    locales.map((locale) => [locale, `${siteConfig.url}${getLocalizedPath(locale, pathname)}`])
  ) as Partial<Record<Locale, string>>;
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
