import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutHero} from '@/components/about/AboutHero';
import {HistoryTimeline} from '@/components/about/HistoryTimeline';
import {VisionContent} from '@/components/about/VisionContent';
import {SiteFooterServer} from '@/components/layout/SiteFooterServer';
import {SiteHeaderServer} from '@/components/layout/SiteHeaderServer';
import {getHistoryTimeline} from '@/features/history/api';
import {getAboutPage, PageNotFoundError} from '@/features/pages/api';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getEditorialMetadata} from '@/lib/seo';

type AboutPageProps = {
  params: Promise<{locale: string}>;
};

export const revalidate = 60;

async function getLocale(params: Promise<{locale: string}>): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({params}: AboutPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const [page, layout] = await Promise.all([aboutPage(locale), getSiteLayout(locale)]);
  const path = '/about';
  const title = `${page.content.heroTitle} | ${layout.seoTitleSuffix}`;
  return getEditorialMetadata({locale, path, title, description: page.content.heroSubtitle || layout.seoDescriptionFallback, siteName: layout.siteName, availableLocales: page.availableLocales, indexable: page.indexable});
}

export default async function AboutPage({params}: AboutPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const [page, timelineResult] = await Promise.all([
    aboutPage(locale),
    getHistoryTimeline(locale).then((value) => ({value, failed: false})).catch(() => ({value: {events: []}, failed: true}))
  ]);

  return (
    <>
      <SiteHeaderServer locale={locale} pathname={`/${locale}/about`} />
      <main data-cms-fallback={page.source === 'migration-fallback' ? 'about' : undefined}>
        <AboutHero locale={locale} title={page.content.heroTitle} subtitle={page.content.heroSubtitle} />
        <div className="bg-[image:var(--hhc-page-gradient)] py-10 pb-14">
          <VisionContent content={page.content.vision} />
          <HistoryTimeline content={page.content.history} timeline={timelineResult.value} scriptureLanguage={locale === 'ko' ? 'en' : locale} errorMessage={timelineResult.failed ? messages.about.historyLoadError : undefined} />
        </div>
      </main>
      <SiteFooterServer locale={locale} pathname={`/${locale}/about`} />
    </>
  );
}

async function aboutPage(locale: Locale) {
  try {
    return await getAboutPage(locale);
  } catch (error) {
    if (error instanceof PageNotFoundError) notFound();
    throw error;
  }
}
