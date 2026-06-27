import type {Metadata} from 'next';
import {Suspense} from 'react';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AboutHero} from '@/components/about/AboutHero';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {WeeklyArchive} from '@/components/literature-ministry/WeeklyArchive';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type LiteratureMinistryPageProps = {
  params: Promise<{locale: string}>;
};

async function getLocale(params: Promise<{locale: string}>): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({params}: LiteratureMinistryPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);

  return {
    title: `${messages.literatureMinistry.heroTitle} | ${messages.site.name}`,
    description: messages.literatureMinistry.heroSubtitle,
    alternates: {
      canonical: getLocalizedPath(locale, '/literature-ministry'),
      languages: getAlternates('/literature-ministry')
    },
    openGraph: {
      title: `${messages.literatureMinistry.heroTitle} | ${messages.site.name}`,
      description: messages.literatureMinistry.heroSubtitle,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/literature-ministry')}`,
      siteName: siteConfig.name
    }
  };
}

export default async function LiteratureMinistryPage({params}: LiteratureMinistryPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);

  return (
    <>
      <SiteHeader locale={locale} pathname={`/${locale}/literature-ministry`} />
      <main>
        <AboutHero title={messages.literatureMinistry.heroTitle} subtitle={messages.literatureMinistry.heroSubtitle} />
        <div className="bg-[linear-gradient(180deg,var(--color-cream),#fffaf4)] py-10 pb-14">
          <Suspense fallback={null}>
            <WeeklyArchive locale={locale} messages={messages.literatureMinistry} />
          </Suspense>
        </div>
      </main>
      <SiteFooter locale={locale} pathname={`/${locale}/literature-ministry`} />
    </>
  );
}
