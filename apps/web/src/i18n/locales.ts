import {
  detectLocale,
  getLocaleCookie as getSharedLocaleCookie,
  getStoredLocale,
  isLocale,
  localeCookieName,
  locales,
  type Locale
} from '@hhc/preferences';

export {detectLocale, getStoredLocale, isLocale, localeCookieName, locales, type Locale};

export type LocalizedRecord<T> = Record<Locale, T>;

export const defaultLocale: Locale = 'zh-Hant';

export const localeLabels: Record<Locale, string> = {
  'zh-Hant': '繁中',
  'zh-Hans': '简中',
  en: 'EN'
};

export function getLocaleCookie(locale: Locale, domain = process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN) {
  return getSharedLocaleCookie(locale, {
    hostname: domain ?? (typeof location === 'undefined' ? undefined : location.hostname),
    protocol: typeof location === 'undefined' ? undefined : location.protocol
  });
}
