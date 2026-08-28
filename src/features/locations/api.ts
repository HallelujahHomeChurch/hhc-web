import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import {locationsByLocale} from './mock-data';
import type {LocationItem} from './types';

export async function getLocations(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<LocationItem[]> {
  try {
    return (await client.listLocations(locale)).map(({id, name, address, mapHref}) => ({id, name, address, mapHref}));
  } catch {
    return locationsByLocale[locale] ?? locationsByLocale['zh-Hant'] ?? [];
  }
}
