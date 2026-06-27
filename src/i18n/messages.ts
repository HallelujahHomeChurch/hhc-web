import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import type {Locale} from './locales';

export const messagesByLocale = {
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  en
} as const;

export function getMessages(locale: Locale) {
  return messagesByLocale[locale];
}
