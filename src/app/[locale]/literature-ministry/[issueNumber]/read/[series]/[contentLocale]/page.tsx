import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {bulletinEditions} from '@hallelujahhomechurch/preferences';
import {WeeklyReader} from '@/components/weekly-reader/WeeklyReader';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {validIssueNumber} from '@/features/weekly/entry-target';

type Props = {params: Promise<{locale: string; issueNumber: string; series: string; contentLocale: string}>};
function selectors(params: Awaited<Props['params']>) {
  if (!isLocale(params.locale) || !validIssueNumber(params.issueNumber)) notFound();
  const edition = bulletinEditions.find(edition => edition.series === params.series && edition.locale === params.contentLocale);
  if (!edition) notFound();
  return {locale: params.locale, issueNumber: Number(params.issueNumber), series: edition.series, contentLocale: edition.locale};
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale} = selectors(await params);
  return {title: getMessages(locale).weeklyReader.title, robots: {index: false, follow: false}};
}

export default async function ReaderPage({params}: Props) {
  const selection = selectors(await params);
  setRequestLocale(selection.locale);
  const messages = getMessages(selection.locale).weeklyReader;
  return <><noscript>{messages.noScript}</noscript><WeeklyReader {...selection} messages={messages}/></>;
}
