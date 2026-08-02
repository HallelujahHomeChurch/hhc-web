import type {Metadata} from 'next';
import Link from 'next/link';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {getNewsBySlug} from '@/features/news/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type NewsDetailPageProps = {params: Promise<{locale: string; slug: string}>};

export const dynamic = 'force-dynamic';

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
      images: news.imageSrc ? [{url: news.imageSrc, alt: news.imageAlt}] : undefined,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      siteName: siteConfig.name
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description: news.summary || messages.news.description,
      images: news.imageSrc ? [news.imageSrc] : undefined
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
        <article className="shell max-w-[860px]">
          <Link href={`/${locale}/news`} className="mb-6 inline-flex min-h-11 items-center font-semibold text-primary">
            ← {messages.news.back}
          </Link>
          {news.imageSrc ? (
            <div
              role="img"
              aria-label={news.imageAlt}
              className="mb-7 aspect-[16/9] rounded-xl bg-panel bg-cover bg-center ring-1 ring-panel-border"
              style={{backgroundImage: `url("${news.imageSrc}")`}}
            />
          ) : null}
          <header className="mb-8 border-b border-line pb-7">
            <h1 className="text-[clamp(30px,5vw,48px)] font-semibold leading-tight text-ink">{news.title}</h1>
            {news.summary ? <p className="mt-4 text-lg leading-relaxed text-muted">{news.summary}</p> : null}
            {news.date ? <p className="mt-4 text-sm font-semibold text-muted">{messages.news.publishedAt} · {news.date}</p> : null}
          </header>
          {news.body ? <div className="whitespace-pre-line text-[17px] leading-[1.9] text-ink">{news.body}</div> : null}
        </article>
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}
