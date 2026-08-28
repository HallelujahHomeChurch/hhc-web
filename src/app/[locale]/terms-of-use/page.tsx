import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalDocument} from '@/components/legal/LegalDocument';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type TermsOfUsePageProps = {
  params: Promise<{locale: string}>;
};

async function getLocale(params: Promise<{locale: string}>): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({params}: TermsOfUsePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);
  const description = messages.termsOfUse.heroSubtitle || messages.termsOfUse.intro;

  return {
    title: `${messages.termsOfUse.heroTitle} | ${layout.seoTitleSuffix}`,
    description,
    alternates: {
      canonical: getLocalizedPath(locale, '/terms-of-use'),
      languages: getAlternates('/terms-of-use')
    },
    openGraph: {
      title: `${messages.termsOfUse.heroTitle} | ${layout.seoTitleSuffix}`,
      description,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/terms-of-use')}`,
      siteName: layout.siteName,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${messages.termsOfUse.heroTitle} | ${layout.seoTitleSuffix}`,
      description,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function TermsOfUsePage({params}: TermsOfUsePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);

  return (
    <LegalPageShell
      languageLabel={messages.site.language}
      locale={locale}
      pathname={`/${locale}/terms-of-use`}
      siteName={layout.siteName}
    >
      <LegalDocument content={messages.termsOfUse} />
    </LegalPageShell>
  );
}
