import {getMessages} from '@/i18n/messages';
import type {Locale} from '@/i18n/locales';

export function getHomePageTitle(locale: Locale) {
  return getMessages(locale).site.name;
}
