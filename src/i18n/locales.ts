import {
  detectProductLocale,
  getProductLocaleCookie,
  getStoredProductLocale,
  isProductLocale,
  localeCookieName,
  localeMetadata,
  productLocales,
  type ProductLocale
} from '@hallelujahhomechurch/preferences';

export {
  detectProductLocale as detectLocale,
  getStoredProductLocale as getStoredLocale,
  isProductLocale as isLocale,
  localeCookieName,
  localeMetadata,
  productLocales,
  productLocales as locales,
  type ProductLocale,
  type ProductLocale as Locale
};

export type LocalizedRecord<T> = Partial<Record<ProductLocale, T>>;

export const defaultLocale: ProductLocale = 'zh-Hant';

export const localeLabels = Object.fromEntries(
  localeMetadata.map(({code, shortLabel}) => [code, shortLabel])
) as Record<ProductLocale, string>;

export function getLocaleCookie(locale: ProductLocale, domain = process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN) {
  return getProductLocaleCookie(locale, {
    hostname: domain ?? (typeof location === 'undefined' ? undefined : location.hostname),
    protocol: typeof location === 'undefined' ? undefined : location.protocol
  });
}
