import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import type {LocationItem} from './types';
import {captureHandledError} from '@/lib/observability';

export async function getLocations(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<LocationItem[]> {
  try {
    return (await client.listLocations(locale)).map(({id, name, address, mapHref}) => ({id, name, address, mapHref}));
  } catch (error) {
    captureHandledError(error, {operation: 'locations.list', level: 'warning', tags: {locale}});
    throw error;
  }
}
