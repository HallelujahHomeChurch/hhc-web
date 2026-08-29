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
import {getHomePage, PageNotFoundError} from '@/features/pages/api';
import {getSiteLayout} from '@/features/site-layout/api';
import {getMessages} from '@/i18n/messages';
import {isLocale, type Locale} from '@/i18n/locales';
import {getEditorialMetadata} from '@/lib/seo';

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
  const [page, layout] = await Promise.all([homePage(locale), getSiteLayout(locale)]);
  const description = page.content.heroSubtitle || layout.seoDescriptionFallback;
  return getEditorialMetadata({locale, path: '/', title: layout.seoTitleSuffix, socialTitle: `${layout.seoTitleSuffix} | ${page.content.heroTitle}`, description, siteName: layout.siteName, availableLocales: page.availableLocales, indexable: page.indexable});
}

export default async function HomePage({params}: HomePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const [page, home, layout] = await Promise.all([homePage(locale), getHomeContent(locale), getSiteLayout(locale)]);
  const locations = page.template === 'home.v2'
    ? page.content.locations.toSorted((left, right) => left.sortOrder - right.sortOrder).map(({key, name, address, mapHref}) => ({id: key, name, address, mapHref}))
    : await getLocations(locale);
  const content = page.template === 'home.v2' ? {
    heroTitle: page.content.heroTitle,
    heroSubtitle: page.content.heroSubtitle,
    newsTitle: messages.home.newsTitle,
    moreNews: messages.home.moreNews,
    weeklyTitle: messages.home.weeklyTitle,
    downloadWeekly: messages.home.downloadWeekly,
    videosTitle: messages.home.videosTitle,
    videosSubtitle: page.content.kingdomJoyDescription,
    watchMore: messages.home.watchMore,
    aboutTitle: messages.home.aboutTitle,
    aboutBody: page.content.aboutDescription,
    aboutCta: messages.home.aboutCta,
    locationsTitle: messages.home.locationsTitle,
    mapLink: messages.home.mapLink
  } : page.content;

  return (
    <>
      <SiteHeaderServer locale={locale} pathname={`/${locale}`} />
      <main data-cms-fallback={page.source === 'migration-fallback' ? 'home' : undefined}>
        <HomeHero locale={locale} title={content.heroTitle} subtitle={content.heroSubtitle} imageUrl={page.template === 'home.v2' ? page.content.bannerImageUrl : undefined} />
        <div className="relative z-[3] bg-[image:var(--hhc-page-gradient)] py-8 pb-11">
          <SectionCard className="shell grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.9fr)] gap-8 p-7 max-[900px]:grid-cols-1 max-[620px]:p-5" ariaLabel={`${content.newsTitle} · ${content.weeklyTitle}`}>
            <NewsSection title={content.newsTitle} moreHref={`/${locale}/news`} moreLabel={`${content.moreNews} →`} items={home.news} errorMessage={home.newsFailed ? messages.home.newsLoadError : undefined} />
            <WeeklyCard
              locale={locale}
              ctaLabel={content.downloadWeekly}
              messages={{
                loading: messages.home.weeklyLoading,
                downloading: messages.home.weeklyDownloading,
                error: messages.home.weeklyLoadError,
                retry: messages.home.retry
              }}
            />
          </SectionCard>
          <VideoSection title={content.videosTitle} subtitle={content.videosSubtitle} ctaLabel={content.watchMore} channelHref={layout.links.musicYoutube} items={home.videos} errorMessage={home.videosFailed ? messages.home.videosLoadError : undefined} />
          <AboutTeaser locale={locale} title={content.aboutTitle} body={content.aboutBody} ctaLabel={`${content.aboutCta} →`} />
          <LocationSection title={content.locationsTitle} mapLabel={content.mapLink} items={locations} />
        </div>
      </main>
      <SiteFooterServer locale={locale} pathname={`/${locale}`} />
    </>
  );
}

async function homePage(locale: Locale) {
  try {
    return await getHomePage(locale);
  } catch (error) {
    if (error instanceof PageNotFoundError) notFound();
    throw error;
  }
}
