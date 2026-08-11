'use client';

import {usePathname} from 'next/navigation';
import {defaultLocale, isLocale} from '@/i18n/locales';

export function LocaleDocument({children, suppressHydrationWarning}: {
  children: React.ReactNode;
  suppressHydrationWarning?: boolean;
}) {
  const routeLocale = usePathname().split('/')[1];
  const locale = routeLocale && isLocale(routeLocale) ? routeLocale : defaultLocale;

  return <html lang={locale} suppressHydrationWarning={suppressHydrationWarning}>{children}</html>;
}
