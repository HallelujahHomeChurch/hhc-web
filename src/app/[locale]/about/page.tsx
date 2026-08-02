import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutHero} from '@/components/about/AboutHero';
import {HistoryTimeline} from '@/components/about/HistoryTimeline';
import {VisionContent} from '@/components/about/VisionContent';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {PageNavigation} from '@/components/ui/PageNavigation';
import {getHistoryTimelinePage} from '@/features/history/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type AboutPageProps = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{page?: string}>;
};

export const dynamic = 'force-dynamic';

async function getLocale(params: Promise<{locale: string}>): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({params, searchParams}: AboutPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const path = page === 1 ? '/about' : `/about?page=${page}`;

  return {
    title: `${messages.about.heroTitle} | ${messages.site.name}`,
    description: messages.about.heroSubtitle,
    alternates: {
      canonical: getLocalizedPath(locale, path),
      languages: getAlternates(path)
    },
    openGraph: {
      title: `${messages.about.heroTitle} | ${messages.site.name}`,
      description: messages.about.heroSubtitle,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      siteName: siteConfig.name
    },
    twitter: {
      card: 'summary_large_image',
      title: `${messages.about.heroTitle} | ${messages.site.name}`,
      description: messages.about.heroSubtitle
    }
  };
}

export default async function AboutPage({params, searchParams}: AboutPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const timelineResult = await getHistoryTimelinePage(locale, page, 12).then((value) => ({value, failed: false})).catch(() => ({value: {events: [], meta: {page, pageSize: 12, total: 0}}, failed: true}));
  const totalPages = Math.max(1, Math.ceil(timelineResult.value.meta.total / timelineResult.value.meta.pageSize));

  return (
    <>
      <SiteHeader locale={locale} pathname={`/${locale}/about`} />
      <main>
          <AboutHero locale={locale} title={messages.about.heroTitle} subtitle={messages.about.heroSubtitle} />
        <div className="bg-[image:var(--hhc-page-gradient)] py-10 pb-14">
          <VisionContent content={messages.about.vision} />
          <HistoryTimeline content={messages.about.history} timeline={timelineResult.value} errorMessage={timelineResult.failed ? messages.about.historyLoadError : undefined} />
          <div className="shell"><PageNavigation basePath={`/${locale}/about`} page={page} totalPages={totalPages} labels={messages.site.pagination} /></div>
        </div>
      </main>
      <SiteFooter locale={locale} pathname={`/${locale}/about`} />
    </>
  );
}
