import type {Metadata} from 'next';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {StatementBody} from '@/components/statements/StatementBody';
import {publicContentClient} from '@/features/content/client';
import {getNewsBySlug} from '@/features/news/api';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type Props = {params: Promise<{locale: string; slug: string}>};
export const dynamic = 'force-dynamic';
async function load(params: Props['params']) {
  const {locale, slug} = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  try {
    const news = await getNewsBySlug(locale, slug, publicContentClient(true));
    if (news.kind !== 'statement') notFound();
    return {news, locale, slug};
  } catch (error) {
    if (error instanceof HhcWebApiError && error.status === 404) notFound();
    throw error;
  }
}
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {news, locale, slug} = await load(params);
  const layout = await getSiteLayout(locale);
  const path = `/statements/${slug}`;
  const canonical = getLocalizedPath(news.resolvedLocale, path);
  return {
    title: `${news.title} | ${layout.seoTitleSuffix}`,
    robots: {index: false, follow: true},
    alternates: {canonical, languages: getAlternates(path, news.availableLocales)},
    openGraph: {title: news.title, url: `${siteConfig.url}${canonical}`, siteName: layout.siteName, locale: getOpenGraphLocale(news.resolvedLocale), images: [siteConfig.defaultOgImage]},
    twitter: {card: 'summary', title: news.title}
  };
}
export default async function StatementPage({params}: Props) {
  const {news, locale, slug} = await load(params);
  const messages = getMessages(locale);
  const labels = messages.site.statement;
  return LegalPageShell({locale, pathname: `/${locale}/statements/${slug}`, children: <article className="mx-auto max-w-[760px] px-5 py-10 max-[620px]:py-6">
    <header className="mb-8 border-b border-line pb-6"><p className="mb-3 text-sm font-semibold tracking-widest text-primary">{labels.notice}</p><h1 lang={news.resolvedLocale} className="text-[clamp(28px,4vw,42px)] font-semibold leading-snug text-ink">{news.title}</h1><p className="mt-4 text-sm text-muted">{labels.date} · <time dateTime={news.displayDate} lang={news.resolvedLocale}>{news.date}</time></p></header>
    <StatementBody body={news.body} locale={news.resolvedLocale} />
  </article>});
}
