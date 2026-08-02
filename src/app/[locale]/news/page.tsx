import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {NewsSection} from '@/components/home/NewsSection';
import {AboutHero} from '@/components/about/AboutHero';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {PageNavigation} from '@/components/ui/PageNavigation';
import {getNewsPage} from '@/features/news/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type NewsPageProps = {params: Promise<{locale: string}>; searchParams: Promise<{page?: string}>};

export const dynamic = 'force-dynamic';

async function resolveLocale(params: NewsPageProps['params']): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({params, searchParams}: NewsPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const messages = getMessages(locale);
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const path = page === 1 ? '/news' : `/news?page=${page}`;
  return {
    title: `${messages.news.title} | ${messages.site.name}`,
    description: messages.news.description,
    alternates: {canonical: getLocalizedPath(locale, path), languages: getAlternates(path)},
    openGraph: {
      title: `${messages.news.title} | ${messages.site.name}`,
      description: messages.news.description,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      siteName: siteConfig.name,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${messages.news.title} | ${messages.site.name}`,
      description: messages.news.description,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function NewsPage({params, searchParams}: NewsPageProps) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const result = await getNewsPage(locale, page, 12).then((value) => ({...value, failed: false})).catch(() => ({items: [], meta: {page, pageSize: 12, total: 0}, failed: true}));
  const totalPages = Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize));
  const pathname = `/${locale}/news`;

  return (
    <>
      <SiteHeader locale={locale} pathname={pathname} />
      <main className="min-h-[calc(100vh-76px)] bg-[image:var(--hhc-page-gradient)]">
        <AboutHero locale={locale} title={messages.news.title} subtitle={messages.news.heroSubtitle} />
        <section className="shell py-10 max-[620px]:py-6" aria-label={messages.news.allNews}>
          <NewsSection
            title={messages.news.allNews}
            items={result.items}
            errorMessage={result.failed ? messages.news.loadError : result.items.length === 0 ? messages.news.empty : undefined}
          />
          <PageNavigation basePath={pathname} page={page} totalPages={totalPages} labels={messages.site.pagination} />
        </section>
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}
