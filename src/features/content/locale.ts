import {isLocale, type Locale} from '@/i18n/locales';

type RawContentLocaleMetadata = {
  resolvedLocale?: unknown;
  availableLocales?: unknown;
};

export type ContentLocaleMetadata = {
  requestedLocale: Locale;
  resolvedLocale: Locale;
  availableLocales: Locale[];
};

export function getContentLocaleMetadata(requestedLocale: Locale, value: RawContentLocaleMetadata): ContentLocaleMetadata {
  const resolvedLocale = typeof value.resolvedLocale === 'string' && isLocale(value.resolvedLocale)
    ? value.resolvedLocale
    : requestedLocale;
  const availableLocales = Array.isArray(value.availableLocales)
    ? [...new Set(value.availableLocales.filter((locale): locale is Locale => typeof locale === 'string' && isLocale(locale)))]
    : [];

  return {requestedLocale, resolvedLocale, availableLocales};
}

export function formatContentDate(value: string, locale: Locale): string {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value);
  if (!match) return '';
  const [, year, month, day] = match;
  if (!month) return year;
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: day ? 'numeric' : 'long',
      ...(day ? {day: 'numeric'} : {}),
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day ?? 1))));
  }
  if (locale === 'ko') return `${year}년 ${Number(month)}월${day ? ` ${Number(day)}일` : ''}`;
  return `${year}年${Number(month)}月${day ? `${Number(day)}日` : ''}`;
}
