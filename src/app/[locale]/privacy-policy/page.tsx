import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalDocument} from '@/components/legal/LegalDocument';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {getLegalPage, PageNotFoundError} from '@/features/pages/api';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getEditorialMetadata} from '@/lib/seo';

type PrivacyPolicyPageProps = {
  params: Promise<{locale: string}>;
};

export const dynamic = 'force-dynamic';

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
  const [page, layout] = await Promise.all([privacyPage(locale), getSiteLayout(locale)]);
  const description = page.content.heroSubtitle || page.content.intro || layout.seoDescriptionFallback;
  return getEditorialMetadata({locale, path: '/privacy-policy', title: `${page.content.heroTitle} | ${layout.seoTitleSuffix}`, description, siteName: layout.siteName, availableLocales: page.availableLocales, indexable: page.indexable});
}

export default async function PrivacyPolicyPage({params}: PrivacyPolicyPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const page = await privacyPage(locale);

  return LegalPageShell({
    locale,
    pathname: `/${locale}/privacy-policy`,
    children: <LegalDocument content={page.content} />
  });
}

async function privacyPage(locale: Locale) {
  try {
    return await getLegalPage('privacy-policy', locale);
  } catch (error) {
    if (error instanceof PageNotFoundError) notFound();
    throw error;
  }
}
