import type {Metadata} from 'next';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {NewsDetailArticle} from '@/components/news/NewsDetailArticle';
import {getNewsBySlug} from '@/features/news/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

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
  return {
    title: `${news.title} | ${messages.site.name}`,
    description: news.summary || messages.news.description,
    alternates: {canonical: getLocalizedPath(locale, path), languages: getAlternates(path)},
    openGraph: {
      title: news.title,
      description: news.summary || messages.news.description,
      images: [{url: news.imageSrc || siteConfig.defaultOgImage, alt: news.imageAlt || messages.site.name}],
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      siteName: siteConfig.name
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description: news.summary || messages.news.description,
      images: [news.imageSrc || siteConfig.defaultOgImage]
    }
  };
}

export default async function NewsDetailPage({params}: NewsDetailPageProps) {
  const {locale, slug} = await resolveParams(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const news = await loadNews(locale, slug);
  const pathname = `/${locale}/news/${slug}`;

  return (
    <>
      <SiteHeader locale={locale} pathname={pathname} />
      <main className="min-h-[calc(100vh-76px)] bg-[image:var(--hhc-page-gradient)] py-10 max-[620px]:py-6">
        <NewsDetailArticle news={news} backHref={`/${locale}/news`} backLabel={messages.news.back} publishedAtLabel={messages.news.publishedAt} />
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}
