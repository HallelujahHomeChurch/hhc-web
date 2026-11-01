import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {LineBrowserHandoff} from '@/components/layout/LineBrowserHandoff';
import {isLocale, productLocales} from '@/i18n/locales';

export const metadata: Metadata = {robots: {index: false, follow: false}};

export function generateStaticParams() {
  return productLocales.map(locale => ({locale}));
}

export default async function LineBrowserPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const {site} = (await import(`../../../i18n/locales/${locale}.json`)).default;
  return <NextIntlClientProvider locale={locale} messages={{site: {
    name: site.name, englishName: site.englishName, lineBrowser: site.lineBrowser
  }}}><LineBrowserHandoff /></NextIntlClientProvider>;
}
