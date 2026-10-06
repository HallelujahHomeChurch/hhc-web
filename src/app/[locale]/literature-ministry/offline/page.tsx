import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {OfflineContentPage} from '@/components/weekly-reader/OfflineContentPage';

export const metadata: Metadata = {robots: {index: false, follow: false}};
export default async function OfflinePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <OfflineContentPage locale={locale} messages={getMessages(locale).weeklyReader}/>;
}
