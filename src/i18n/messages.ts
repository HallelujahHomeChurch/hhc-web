import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import type {ProductLocale} from './locales';

export const messagesByLocale = {
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  en,
  ja,
  ko
} as const satisfies Record<ProductLocale, typeof zhHant>;

export function getMessages(locale: ProductLocale) {
  return messagesByLocale[locale];
}

/** Series labels for client components that must not import every locale catalog. */
export function bulletinSeriesLabels(locale: ProductLocale) {
  const {general, children} = messagesByLocale[locale].literatureMinistry;
  return {general, children};
}
