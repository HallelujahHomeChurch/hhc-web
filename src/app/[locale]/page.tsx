import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutTeaser} from '@/components/home/AboutTeaser';
import {HomeHero} from '@/components/home/HomeHero';
import {LocationSection} from '@/components/home/LocationSection';
import {NewsSection} from '@/components/home/NewsSection';
import {VideoSection} from '@/components/home/VideoSection';
import {WeeklyCard} from '@/components/home/WeeklyCard';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {SectionCard} from '@/components/ui/SectionCard';
import {getHomeContent} from '@/features/home/api';
import {getLocations} from '@/features/locations/api';
import {getMessages} from '@/i18n/messages';
import {isLocale, type Locale} from '@/i18n/locales';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {getHomePageTitle} from '@/lib/home-metadata';
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

  return {
    title: getHomePageTitle(locale),
    description: messages.home.heroSubtitle,
    alternates: {
      canonical: getLocalizedPath(locale, '/'),
      languages: getAlternates('/')
    },
    openGraph: {
      title: `${messages.site.name} | ${messages.home.heroTitle}`,
      description: messages.home.heroSubtitle,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/')}`,
      siteName: siteConfig.name,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${messages.site.name} | ${messages.home.heroTitle}`,
      description: messages.home.heroSubtitle,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function HomePage({params}: HomePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const [homeResult] = await Promise.allSettled([getHomeContent(locale)]);
  const news = homeResult.status === 'fulfilled' ? homeResult.value.news : [];
  const videos = homeResult.status === 'fulfilled' ? homeResult.value.videos : [];
  const locations = getLocations(locale);

  return (
    <>
      <SiteHeader locale={locale} pathname={`/${locale}`} />
      <main>
        <HomeHero locale={locale} title={messages.home.heroTitle} subtitle={messages.home.heroSubtitle} />
        <div className="relative z-[3] bg-[image:var(--hhc-page-gradient)] py-8 pb-11">
          <SectionCard className="shell grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.9fr)] gap-8 p-7 max-[900px]:grid-cols-1 max-[620px]:p-5" ariaLabel={`${messages.home.newsTitle} · ${messages.home.weeklyTitle}`}>
            <NewsSection title={messages.home.newsTitle} moreHref={`/${locale}/news`} moreLabel={`${messages.home.moreNews} →`} items={news} errorMessage={homeResult.status === 'rejected' ? messages.home.newsLoadError : undefined} />
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
          <VideoSection title={messages.home.videosTitle} subtitle={messages.home.videosSubtitle} ctaLabel={messages.home.watchMore} channelHref={siteConfig.music.youtube} items={videos} errorMessage={homeResult.status === 'rejected' ? messages.home.videosLoadError : undefined} />
          <AboutTeaser locale={locale} title={messages.home.aboutTitle} body={messages.home.aboutBody} ctaLabel={`${messages.home.aboutCta} →`} />
          <LocationSection title={messages.home.locationsTitle} mapLabel={messages.home.mapLink} items={locations} />
        </div>
      </main>
      <SiteFooter locale={locale} pathname={`/${locale}`} />
    </>
  );
}
