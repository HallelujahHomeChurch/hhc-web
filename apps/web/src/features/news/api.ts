import type {Locale} from '@/i18n/locales';
import {newsByLocale} from './mock-data';

export function getNews(locale: Locale) {
  return newsByLocale[locale];
}
