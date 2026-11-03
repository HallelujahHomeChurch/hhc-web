import {videoStartTime} from '@/features/member-videos/share';
import type {Metadata} from 'next';
import {notFound, permanentRedirect} from 'next/navigation';
import {isLocale} from '@/i18n/locales';
import {legacyVideoPath, recordingIdPattern, videoShareMetadata} from '@/features/member-videos/share-metadata';

type PageProps = {searchParams?:Promise<{t?:string|string[]}>;params: Promise<{locale: string; id: string}>};
export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, id} = await params;
  if (!isLocale(locale) || !recordingIdPattern.test(id)) notFound();
  const canonical=await legacyVideoPath(id);
  if(!canonical)notFound();
  return videoShareMetadata(canonical.slice('/video/'.length));
}

export default async function MemberVideoWatchPage({params,searchParams}: PageProps) {
  const {locale, id} = await params;
  const startAt=videoStartTime((await searchParams)?.t);
  if (!isLocale(locale) || !recordingIdPattern.test(id)) notFound();
  const canonical = await legacyVideoPath(id);
  if (!canonical) notFound();
  permanentRedirect(`${canonical}${startAt === undefined ? '' : `?t=${startAt}`}`);
}
