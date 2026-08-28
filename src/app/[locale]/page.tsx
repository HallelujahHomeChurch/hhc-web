import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutTeaser} from '@/components/home/AboutTeaser';
import {HomeHero} from '@/components/home/HomeHero';
import {LocationSection} from '@/components/home/LocationSection';
import {NewsSection} from '@/components/home/NewsSection';
import {VideoSection} from '@/components/home/VideoSection';
import {WeeklyCard} from '@/components/home/WeeklyCard';
import {SiteFooterServer} from '@/components/layout/SiteFooterServer';
import {SiteHeaderServer} from '@/components/layout/SiteHeaderServer';
import {SectionCard} from '@/components/ui/SectionCard';
import {getHomeContent} from '@/features/home/api';
import {getLocations} from '@/features/locations/api';
import {getSiteLayout} from '@/features/site-layout/api';
import {getMessages} from '@/i18n/messages';
import {isLocale, type Locale} from '@/i18n/locales';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type HomePageProps = {
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

export async function generateMetadata({params}: HomePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);

  return {
    title: layout.seoTitleSuffix,
    description: messages.home.heroSubtitle,
    alternates: {
      canonical: getLocalizedPath(locale, '/'),
      languages: getAlternates('/')
    },
    openGraph: {
      title: `${layout.seoTitleSuffix} | ${messages.home.heroTitle}`,
      description: messages.home.heroSubtitle,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/')}`,
      siteName: layout.siteName,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${layout.seoTitleSuffix} | ${messages.home.heroTitle}`,
      description: messages.home.heroSubtitle,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function HomePage({params}: HomePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const [home, locations, layout] = await Promise.all([getHomeContent(locale), getLocations(locale), getSiteLayout(locale)]);

  return (
    <>
      <SiteHeaderServer locale={locale} pathname={`/${locale}`} />
      <main>
        <HomeHero locale={locale} title={messages.home.heroTitle} subtitle={messages.home.heroSubtitle} />
        <div className="relative z-[3] bg-[image:var(--hhc-page-gradient)] py-8 pb-11">
          <SectionCard className="shell grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.9fr)] gap-8 p-7 max-[900px]:grid-cols-1 max-[620px]:p-5" ariaLabel={`${messages.home.newsTitle} · ${messages.home.weeklyTitle}`}>
            <NewsSection title={messages.home.newsTitle} moreHref={`/${locale}/news`} moreLabel={`${messages.home.moreNews} →`} items={home.news} errorMessage={home.newsFailed ? messages.home.newsLoadError : undefined} />
            <WeeklyCard
              locale={locale}
              ctaLabel={messages.home.downloadWeekly}
              messages={{
                loading: messages.home.weeklyLoading,
                downloading: messages.home.weeklyDownloading,
                error: messages.home.weeklyLoadError,
                retry: messages.home.retry
              }}
            />
          </SectionCard>
          <VideoSection title={messages.home.videosTitle} subtitle={messages.home.videosSubtitle} ctaLabel={messages.home.watchMore} channelHref={layout.links.musicYoutube} items={home.videos} errorMessage={home.videosFailed ? messages.home.videosLoadError : undefined} />
          <AboutTeaser locale={locale} title={messages.home.aboutTitle} body={messages.home.aboutBody} ctaLabel={`${messages.home.aboutCta} →`} />
          <LocationSection title={messages.home.locationsTitle} mapLabel={messages.home.mapLink} items={locations} />
        </div>
      </main>
      <SiteFooterServer locale={locale} pathname={`/${locale}`} />
    </>
  );
}
