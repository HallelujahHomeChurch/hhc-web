import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalDocument} from '@/components/legal/LegalDocument';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
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

  const description = messages.privacyPolicy.heroSubtitle || messages.privacyPolicy.intro;

  return {
    title: `${messages.privacyPolicy.heroTitle} | ${messages.site.name}`,
    description,
    alternates: {
      canonical: getLocalizedPath(locale, '/privacy-policy'),
      languages: getAlternates('/privacy-policy')
    },
    openGraph: {
      title: `${messages.privacyPolicy.heroTitle} | ${messages.site.name}`,
      description,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/privacy-policy')}`,
      siteName: siteConfig.name
    }
  };
}

export default async function PrivacyPolicyPage({params}: PrivacyPolicyPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);

  return (
    <>
      <SiteHeader locale={locale} pathname={`/${locale}/privacy-policy`} />
      <main>
        <LegalDocument content={messages.privacyPolicy} />
      </main>
      <SiteFooter locale={locale} pathname={`/${locale}/privacy-policy`} />
    </>
  );
}
