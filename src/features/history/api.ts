import type {Locale} from '@/i18n/locales';
import {historyByLocale} from './mock-data';

export function getHistoryTimeline(locale: Locale) {
  return historyByLocale[locale];
}
