import type {Locale} from '@/i18n/locales';
import {videosByLocale} from './mock-data';

export function getVideos(locale: Locale) {
  return videosByLocale[locale];
}
