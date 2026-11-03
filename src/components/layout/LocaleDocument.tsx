'use client';

import {useParams, usePathname} from 'next/navigation';
import {isLocale} from '@/i18n/locales';

export function LocaleDocument({children, suppressHydrationWarning}: {
  children: React.ReactNode;
  suppressHydrationWarning?: boolean;
}) {
  const params = useParams<{locale?: string}>();
  const segments = usePathname().split('/');
  const routeLocale = segments[1] === 'line-browser' ? segments[2] : segments[1];
  const locale = params.locale && isLocale(params.locale) ? params.locale : routeLocale && isLocale(routeLocale) ? routeLocale : 'und';

  return <html lang={locale} suppressHydrationWarning={suppressHydrationWarning}>{children}</html>;
}
