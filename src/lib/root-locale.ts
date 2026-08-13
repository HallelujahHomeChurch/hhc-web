import {detectLocale, getStoredLocale, type Locale} from '@/i18n/locales';

const supportedLanguage = /^(?:zh|en|ja|ko)(?:-|$)/i;
const languagePreference = /^\s*([a-z*]+(?:-[a-z0-9]+)*)\s*(?:;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i;

export function resolveRootLocale(cookieHeader: string, acceptLanguage: string): Locale | undefined {
  const storedLocale = getStoredLocale(cookieHeader);
  if (storedLocale) return storedLocale;

  const preferences = acceptLanguage.split(',').filter(Boolean).map((value, index) => {
    const match = value.match(languagePreference);
    return match && {language: match[1], quality: Number(match[2] ?? 1), index};
  });

  if (preferences.some((preference) => !preference)) return undefined;

  const languages = preferences
    .filter((preference): preference is NonNullable<typeof preference> => preference !== null && preference.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map(({language}) => language);

  return languages.some((language) => supportedLanguage.test(language))
    ? detectLocale(languages)
    : undefined;
}
