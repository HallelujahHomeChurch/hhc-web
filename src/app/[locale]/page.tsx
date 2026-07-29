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
import {getLocations} from '@/features/locations/api';
import {getNews} from '@/features/news/api';
import {getVideos} from '@/features/videos/api';
import {getMessages} from '@/i18n/messages';
import {isLocale, type Locale} from '@/i18n/locales';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type HomePageProps = {
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

export function getHomePageTitle(locale: Locale) {
  return getMessages(locale).site.name;
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
      siteName: siteConfig.name
    }
  };
}

export default async function HomePage({params}: HomePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const [newsResult, videosResult] = await Promise.allSettled([getNews(locale), getVideos(locale)]);
  const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
  const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];
  const locations = getLocations(locale);

  return (
    <>
      <SiteHeader locale={locale} pathname={`/${locale}`} />
      <main>
        <HomeHero title={messages.home.heroTitle} subtitle={messages.home.heroSubtitle} />
        <div className="relative z-[3] bg-[image:var(--hhc-page-gradient)] py-8 pb-11">
          <SectionCard className="shell grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.9fr)] gap-8 p-7 max-[900px]:grid-cols-1 max-[620px]:p-5" ariaLabel="最新消息與週報">
            <NewsSection title={messages.home.newsTitle} moreLabel={`${messages.home.moreNews} →`} items={news} errorMessage={newsResult.status === 'rejected' ? messages.home.newsLoadError : undefined} />
            <WeeklyCard
              locale={locale}
              ctaLabel={`${messages.home.downloadWeekly} ↓`}
              messages={{
                loading: messages.home.weeklyLoading,
                error: messages.home.weeklyLoadError,
                retry: messages.home.retry
              }}
            />
          </SectionCard>
          <VideoSection title={messages.home.videosTitle} subtitle={messages.home.videosSubtitle} ctaLabel={messages.home.watchMore} channelHref={siteConfig.music.youtube} items={videos} errorMessage={videosResult.status === 'rejected' ? messages.home.videosLoadError : undefined} />
          <AboutTeaser locale={locale} title={messages.home.aboutTitle} body={messages.home.aboutBody} ctaLabel={`${messages.home.aboutCta} →`} />
          <LocationSection title={messages.home.locationsTitle} mapLabel={messages.home.mapLink} items={locations} />
        </div>
      </main>
      <SiteFooter locale={locale} pathname={`/${locale}`} />
    </>
  );
}
