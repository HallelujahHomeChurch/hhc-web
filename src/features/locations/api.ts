import type {Locale} from '@/i18n/locales';
import {locationsByLocale} from './mock-data';

export function getLocations(locale: Locale) {
  return locationsByLocale[locale] ?? locationsByLocale['zh-Hant'] ?? [];
}
