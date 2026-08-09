import {detectLocale, getStoredLocale, type Locale} from '@/i18n/locales';

export function resolveRootLocale(cookieHeader: string, acceptLanguage: string): Locale {
  return getStoredLocale(cookieHeader) ?? detectLocale(acceptLanguage.split(',').map((value) => value.split(';', 1)[0].trim()).filter(Boolean));
}
