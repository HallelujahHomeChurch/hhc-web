import type {Metadata} from 'next';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {NewsDetailArticle} from '@/components/news/NewsDetailArticle';
import {NewsSection} from '@/components/home/NewsSection';
import {getNewsBySlug, getNewsPage} from '@/features/news/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';
import {normalizeMetaDescription, organizationId, organizationStructuredData, serializeJsonLd, toAbsoluteHttpsUrl} from '@/lib/structured-data';

type NewsDetailPageProps = {params: Promise<{locale: string; slug: string}>};

export const revalidate = 60;

async function resolveParams(params: NewsDetailPageProps['params']): Promise<{locale: Locale; slug: string}> {
  const {locale, slug} = await params;
  if (!isLocale(locale)) notFound();
  return {locale, slug};
}

async function loadNews(locale: Locale, slug: string) {
  try {
    return await getNewsBySlug(locale, slug);
  } catch (error) {
    if (error instanceof HhcWebApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({params}: NewsDetailPageProps): Promise<Metadata> {
  const {locale, slug} = await resolveParams(params);
  const messages = getMessages(locale);
  const news = await loadNews(locale, slug);
  const path = `/news/${slug}`;
  const canonicalPath = getLocalizedPath(news.resolvedLocale, path);
  const description = normalizeMetaDescription(news.summary) || messages.news.description;
  return {
    title: `${news.title} | ${messages.site.name}`,
    description,
    alternates: {canonical: canonicalPath, languages: getAlternates(path, news.availableLocales)},
    openGraph: {
      title: news.title,
      description,
      images: [{url: news.imageSrc || siteConfig.defaultOgImage, alt: news.imageAlt || messages.site.name}],
      locale: getOpenGraphLocale(news.resolvedLocale),
      url: `${siteConfig.url}${canonicalPath}`,
      siteName: siteConfig.name
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description,
      images: [news.imageSrc || siteConfig.defaultOgImage]
    }
  };
}

export default async function NewsDetailPage({params}: NewsDetailPageProps) {
  const {locale, slug} = await resolveParams(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const news = await loadNews(locale, slug);
  const resolvedMessages = getMessages(news.resolvedLocale);
  const pathname = `/${locale}/news/${slug}`;
  const canonicalPath = getLocalizedPath(news.resolvedLocale, `/news/${slug}`);
  const canonicalUrl = new URL(canonicalPath, siteConfig.url).toString();
  const newsListUrl = new URL(`/${news.resolvedLocale}/news`, siteConfig.url).toString();
  const homeUrl = new URL(`/${news.resolvedLocale}`, siteConfig.url).toString();
  const description = normalizeMetaDescription(news.summary) || messages.news.description;
  const image = toAbsoluteHttpsUrl(news.imageSrc);
  const datePublished = news.firstPublishedAt && !Number.isNaN(Date.parse(news.firstPublishedAt)) ? news.firstPublishedAt : undefined;
  const dateModified = datePublished && news.lastPublishedAt && Date.parse(news.lastPublishedAt) > Date.parse(datePublished)
    ? news.lastPublishedAt
    : undefined;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationStructuredData,
      {
        '@type': 'NewsArticle',
        mainEntityOfPage: canonicalUrl,
        headline: news.title,
        description,
        inLanguage: news.resolvedLocale,
        ...(image ? {image} : {}),
        ...(datePublished ? {datePublished} : {}),
        ...(dateModified ? {dateModified} : {}),
        author: news.authorName ? {'@type': 'Person', name: news.authorName} : {'@id': organizationId},
        publisher: {'@id': organizationId}
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {'@type': 'ListItem', position: 1, name: resolvedMessages.site.nav.home, item: homeUrl},
          {'@type': 'ListItem', position: 2, name: resolvedMessages.news.title, item: newsListUrl},
          {'@type': 'ListItem', position: 3, name: news.title, item: canonicalUrl}
        ]
      }
    ]
  };
  const recentNews = await getNewsPage(news.resolvedLocale, 1, 4)
    .then(({items}) => items.filter((item) => item.id !== news.id).slice(0, 3))
    .catch(() => []);

  return (
    <>
      <SiteHeader locale={locale} pathname={pathname} />
      <main className="min-h-[calc(100vh-76px)] bg-[image:var(--hhc-page-gradient)] py-10 max-[620px]:py-6">
        <NewsDetailArticle
          news={news}
          backHref={`/${locale}/news`}
          backLabel={messages.news.back}
          activityDateLabel={messages.news.activityDate}
          authorLabel={messages.news.author}
          publishedAtLabel={messages.news.publishedAt}
          updatedAtLabel={messages.news.updatedAt}
          organizationName={resolvedMessages.site.name}
        />
        {recentNews.length ? <section className="shell mt-16 max-w-[1120px] border-t border-line pt-10">
          <NewsSection title={messages.news.title} moreHref={`/${news.resolvedLocale}/news`} moreLabel={messages.news.allNews} items={recentNews} />
        </section> : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: serializeJsonLd(structuredData)}} />
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}
