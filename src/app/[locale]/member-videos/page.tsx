import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutHero} from '@/components/about/AboutHero';
import {SiteFooterServer} from '@/components/layout/SiteFooterServer';
import {SiteHeaderServer} from '@/components/layout/SiteHeaderServer';
import {MemberVideoZone} from '@/features/member-videos/MemberVideoZone';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath} from '@/lib/seo';

type PageProps = {params: Promise<{locale: string}>; searchParams: Promise<{page?: string}>};

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale).memberVideos;
  return {
    title: messages.heroTitle,
    description: messages.heroSubtitle,
    alternates: {canonical: getLocalizedPath(locale, '/member-videos'), languages: getAlternates('/member-videos')},
    robots: {index: false, follow: false}
  };
}

export default async function MemberVideosPage({params, searchParams}: PageProps) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const page = Number((await searchParams).page);
  const initialPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const messages = getMessages(locale).memberVideos;
  const layout = await getSiteLayout(locale);
  const pathname = `/${locale}/member-videos`;
  return (
    <>
      <SiteHeaderServer locale={locale} pathname={pathname} />
      <MemberVideoZone view="list" initialPage={initialPage} locale={locale} messages={messages} hero={<AboutHero imageUrl={layout.bannerImageUrl} locale={locale} title={messages.heroTitle} subtitle={messages.heroSubtitle} />} />
      <SiteFooterServer locale={locale} pathname={pathname} />
    </>
  );
}
