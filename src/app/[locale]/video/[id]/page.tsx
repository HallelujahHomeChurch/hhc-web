import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooterServer} from '@/components/layout/SiteFooterServer';
import {SiteHeaderServer} from '@/components/layout/SiteHeaderServer';
import {MemberVideoZone} from '@/features/member-videos/MemberVideoZone';
import {videoStartTime} from '@/features/member-videos/share';
import {videoPublicIdPattern, videoShareMetadata} from '@/features/member-videos/share-metadata';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

export const dynamic = 'force-dynamic';
type PageProps = {params: Promise<{locale: string; id: string}>; searchParams: Promise<{t?: string | string[]}>};
export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {id} = await params;
  if (!videoPublicIdPattern.test(id)) notFound();
  return videoShareMetadata(id);
}
export default async function VideoPage({params, searchParams}: PageProps) {
  const {locale, id} = await params;
  if (!isLocale(locale) || !videoPublicIdPattern.test(id)) notFound();
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const pathname = `/video/${id}`;
  return <>
    <SiteHeaderServer locale={locale} pathname={pathname}/>
    <MemberVideoZone publicId={id} startAt={videoStartTime((await searchParams).t)} locale={locale} messages={{...messages.memberVideos, signIn: messages.site.account.signIn, search: messages.site.search.video}} hero={null}/>
    <SiteFooterServer locale={locale} pathname={pathname}/>
  </>;
}
