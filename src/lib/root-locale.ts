import {detectLocale, getStoredLocale, type Locale} from '@/i18n/locales';

const supportedLanguage = /^(?:zh|en|ja|ko)(?:-|$)/i;

export function resolveRootLocale(cookieHeader: string, acceptLanguage: string): Locale | undefined {
  const storedLocale = getStoredLocale(cookieHeader);
  if (storedLocale) return storedLocale;

  const languages = acceptLanguage
    .split(',')
    .map((value) => value.split(';', 1)[0].trim())
    .filter(Boolean);

  return languages.some((language) => supportedLanguage.test(language))
    ? detectLocale(languages)
    : undefined;
}
