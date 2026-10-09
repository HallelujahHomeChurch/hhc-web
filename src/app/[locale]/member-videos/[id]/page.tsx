import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooterServer} from '@/components/layout/SiteFooterServer';
import {SiteHeaderServer} from '@/components/layout/SiteHeaderServer';
import {parseVideoQuery} from '@/features/member-videos/search';
import {MemberVideoZone} from '@/features/member-videos/MemberVideoZone';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

type PageProps = {params: Promise<{locale: string; id: string}>;searchParams:Promise<{q?:string|string[]}>};
export const metadata: Metadata = {robots: {index: false, follow: false}};

export default async function MemberVideoWatchPage({params,searchParams}: PageProps) {
  const {locale, id} = await params;
  if (!isLocale(locale) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) notFound();
  setRequestLocale(locale);
  const {query}=parseVideoQuery((await searchParams).q);
  const messages=getMessages(locale);
  const pathname = `/${locale}/member-videos/${id}`;
  return <>
    <SiteHeaderServer locale={locale} pathname={pathname} searchQuery={query}/>
    <MemberVideoZone locale={locale} messages={{...messages.memberVideos,search:messages.site.search.video}} query={query} hero={null} recordingId={id}/>
    <SiteFooterServer locale={locale} pathname={pathname}/>
  </>;
}
