import {defaultLocale, type Locale} from './locales';

export function replaceLocale(pathname: string, locale: Locale) {
  const segments = pathname.split('/').filter(Boolean);
  const [, ...rest] = segments;
  const path = rest.length > 0 ? `/${rest.join('/')}` : '';

  return `/${locale}${path}`;
}

export function getDefaultPath() {
  return `/${defaultLocale}`;
}
