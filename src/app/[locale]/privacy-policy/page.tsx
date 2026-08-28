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

type PrivacyPolicyPageProps = {
  params: Promise<{locale: string}>;
};

async function getLocale(params: Promise<{locale: string}>): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({params}: PrivacyPolicyPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);

  const description = messages.privacyPolicy.heroSubtitle || messages.privacyPolicy.intro;

  return {
    title: `${messages.privacyPolicy.heroTitle} | ${layout.seoTitleSuffix}`,
    description,
    alternates: {
      canonical: getLocalizedPath(locale, '/privacy-policy'),
      languages: getAlternates('/privacy-policy')
    },
    openGraph: {
      title: `${messages.privacyPolicy.heroTitle} | ${layout.seoTitleSuffix}`,
      description,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/privacy-policy')}`,
      siteName: layout.siteName,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${messages.privacyPolicy.heroTitle} | ${layout.seoTitleSuffix}`,
      description,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function PrivacyPolicyPage({params}: PrivacyPolicyPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);

  return (
    <LegalPageShell
      languageLabel={messages.site.language}
      locale={locale}
      pathname={`/${locale}/privacy-policy`}
      siteName={layout.siteName}
    >
      <LegalDocument content={messages.privacyPolicy} />
    </LegalPageShell>
  );
}
