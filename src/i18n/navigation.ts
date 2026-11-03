import {defaultLocale, type Locale} from './locales';

export function replaceLocale(pathname: string, locale: Locale) {
  if (/^\/video\/[A-Za-z0-9_-]{11}(?:[?#]|$)/.test(pathname)) return pathname;
  const segments = pathname.split('/').filter(Boolean);
  const [, ...rest] = segments;
  const path = rest.length > 0 ? `/${rest.join('/')}` : '';

  return `/${locale}${path}`;
}

export function getDefaultPath() {
  return `/${defaultLocale}`;
}
