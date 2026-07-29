import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutHero} from '@/components/about/AboutHero';
import {HistoryTimeline} from '@/components/about/HistoryTimeline';
import {VisionContent} from '@/components/about/VisionContent';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {getHistoryTimeline} from '@/features/history/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type AboutPageProps = {
  params: Promise<{locale: string}>;
};

export const dynamic = 'force-dynamic';

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
  const messages = getMessages(locale);

  return {
    title: `${messages.about.heroTitle} | ${messages.site.name}`,
    description: messages.about.heroSubtitle,
    alternates: {
      canonical: getLocalizedPath(locale, '/about'),
      languages: getAlternates('/about')
    },
    openGraph: {
      title: `${messages.about.heroTitle} | ${messages.site.name}`,
      description: messages.about.heroSubtitle,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/about')}`,
      siteName: siteConfig.name
    }
  };
}

export default async function AboutPage({params}: AboutPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const timelineResult = await getHistoryTimeline(locale).then((value) => ({value, failed: false})).catch(() => ({value: {events: []}, failed: true}));

  return (
    <>
      <SiteHeader locale={locale} pathname={`/${locale}/about`} />
      <main>
          <AboutHero title={messages.about.heroTitle} subtitle={messages.about.heroSubtitle} />
        <div className="bg-[image:var(--hhc-page-gradient)] py-10 pb-14">
          <VisionContent content={messages.about.vision} />
          <HistoryTimeline content={messages.about.history} timeline={timelineResult.value} errorMessage={timelineResult.failed ? messages.about.historyLoadError : undefined} />
        </div>
      </main>
      <SiteFooter locale={locale} pathname={`/${locale}/about`} />
    </>
  );
}
