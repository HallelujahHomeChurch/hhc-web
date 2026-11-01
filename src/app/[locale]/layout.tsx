import type {Metadata} from 'next';
import {getSiteLayout} from '@/features/site-layout/api';
import {siteConfig} from '@/lib/site';
import {LegalRequiredNavigation} from '@/components/legal/LegalRequiredNavigation';
import {Suspense} from 'react';
import {AnalyticsBoundary} from '@/components/layout/AnalyticsBoundary';
import {NextIntlClientProvider} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale, productLocales, type Locale} from '@/i18n/locales';
import {AccountControlProvider} from '@/components/layout/AccountControl';
import {InitialLoadingBoundary} from '@/components/layout/InitialLoadingBoundary';
import {StatementProvider} from '@/components/statements/StatementProvider';
import {TranslationNotice} from '@/components/layout/TranslationNotice';
import {ReaderServiceWorker} from '@/components/weekly-reader/ReaderServiceWorker';

export async function generateMetadata(): Promise<Metadata> {
  const layout = await getSiteLayout('zh-Hant');
  return {
    metadataBase: new URL(siteConfig.url),
    title: siteConfig.name,
    description: layout.seoDescriptionFallback,
    openGraph: {
      type: 'website',
      title: siteConfig.name,
      description: layout.seoDescriptionFallback,
      siteName: siteConfig.name,
      url: siteConfig.url,
      images: [{url: siteConfig.defaultOgImage, width: 1200, height: 630, alt: siteConfig.name}]
    },
    twitter: {
      card: 'summary_large_image',
      title: siteConfig.name,
      description: layout.seoDescriptionFallback,
      images: [siteConfig.defaultOgImage]
    }
  };
}

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return productLocales.map((locale) => ({locale}));
}

async function getMessages(locale: Locale) {
  const messages = (await import(`../../i18n/locales/${locale}.json`)).default;
  return {site: messages.site};
}

export default async function LocaleLayout({children, params}: LocaleLayoutProps) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);

  const messages = await getMessages(rawLocale);
  return (
    <NextIntlClientProvider locale={rawLocale} messages={messages}>
      <ReaderServiceWorker/>
      <AccountControlProvider labels={messages.site.account}>
        <LegalRequiredNavigation />
        <InitialLoadingBoundary label={messages.site.loading}>
          <StatementProvider locale={rawLocale} labels={messages.site.statement}>
          <div data-locale={rawLocale} lang={rawLocale}>
            <TranslationNotice locale={rawLocale} message={messages.site.translationNotice} dismissLabel={messages.site.translationNoticeDismiss} regionLabel={messages.site.translationNoticeRegion} />
            <Suspense fallback={children}><AnalyticsBoundary locale={rawLocale}>{children}</AnalyticsBoundary></Suspense>
          </div>
          </StatementProvider>
        </InitialLoadingBoundary>
      </AccountControlProvider>
    </NextIntlClientProvider>
  );
}
