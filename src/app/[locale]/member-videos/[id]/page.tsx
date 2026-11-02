import {videoStartTime} from '@/features/member-videos/share';
import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooterServer} from '@/components/layout/SiteFooterServer';
import {SiteHeaderServer} from '@/components/layout/SiteHeaderServer';
import {MemberVideoZone} from '@/features/member-videos/MemberVideoZone';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {recordingIdPattern, recordingShareMetadata} from '@/features/member-videos/share-metadata';

type PageProps = {searchParams?:Promise<{t?:string|string[]}>;params: Promise<{locale: string; id: string}>};
export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, id} = await params;
  if (!isLocale(locale) || !recordingIdPattern.test(id)) notFound();
  return recordingShareMetadata(locale, id);
}

export default async function MemberVideoWatchPage({params,searchParams}: PageProps) {
  const {locale, id} = await params;
  const startAt=videoStartTime((await searchParams)?.t);
  if (!isLocale(locale) || !recordingIdPattern.test(id)) notFound();
  setRequestLocale(locale);
  const messages=getMessages(locale);
  const pathname = `/${locale}/member-videos/${id}`;
  return <>
    <SiteHeaderServer locale={locale} pathname={pathname}/>
    <MemberVideoZone startAt={startAt} locale={locale} messages={{...messages.memberVideos,search:messages.site.search.video}} hero={null} recordingId={id}/>
    <SiteFooterServer locale={locale} pathname={pathname}/>
  </>;
}
