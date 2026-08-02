import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {NewsSection} from '@/components/home/NewsSection';
import {AboutHero} from '@/components/about/AboutHero';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {getNews} from '@/features/news/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type NewsPageProps = {params: Promise<{locale: string}>};

export const dynamic = 'force-dynamic';

async function resolveLocale(params: NewsPageProps['params']): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({params}: NewsPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const messages = getMessages(locale);
  return {
    title: `${messages.news.title} | ${messages.site.name}`,
    description: messages.news.description,
    alternates: {canonical: getLocalizedPath(locale, '/news'), languages: getAlternates('/news')},
    openGraph: {
      title: `${messages.news.title} | ${messages.site.name}`,
      description: messages.news.description,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/news')}`,
      siteName: siteConfig.name
    }
  };
}

export default async function NewsPage({params}: NewsPageProps) {
  const locale = await resolveLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const result = await getNews(locale).then((items) => ({items, failed: false})).catch(() => ({items: [], failed: true}));
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
        </section>
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}
