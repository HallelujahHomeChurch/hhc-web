import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {OfflineReaderShell} from '@/components/weekly-reader/OfflineReaderShell';

export const dynamic = 'force-static';
export const metadata: Metadata = {title: 'Bulletin reader', robots: {index: false, follow: false}};
export default async function ReaderShellPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <OfflineReaderShell locale={locale} messages={getMessages(locale).weeklyReader}/>;
}
