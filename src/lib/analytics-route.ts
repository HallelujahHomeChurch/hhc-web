import type { SafeAnalyticsRoute } from '@hallelujahhomechurch/preferences';
import { isLocale } from '@/i18n/locales';

export function publicAnalyticsRoute(
  pathname: string,
  search: string,
  hash: string,
): SafeAnalyticsRoute | null {
  if (search || hash) return null;
  const segments = pathname.split('/');
  if (!isLocale(segments[1])) return null;
  const path = '/' + segments.slice(2).join('/');
  const routes: Record<string, SafeAnalyticsRoute> = {
    '/': 'home',
    '/about': 'about',
    '/news': 'news',
    '/literature-ministry': 'literature',
  };
  if (routes[path]) return routes[path];
  if (/^\/news\/[A-Za-z0-9_-]+$/.test(path)) return 'news_detail';
  return null;
}
