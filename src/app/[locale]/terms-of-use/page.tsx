import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalDocument} from '@/components/legal/LegalDocument';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {getLegalPage, PageNotFoundError} from '@/features/pages/api';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getEditorialMetadata} from '@/lib/seo';

type TermsOfUsePageProps = {
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

export async function generateMetadata({params}: TermsOfUsePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const [page, layout] = await Promise.all([termsPage(locale), getSiteLayout(locale)]);
  const description = page.content.heroSubtitle || page.content.intro || layout.seoDescriptionFallback;
  return getEditorialMetadata({locale, path: '/terms-of-use', title: `${page.content.heroTitle} | ${layout.seoTitleSuffix}`, description, siteName: layout.siteName, availableLocales: page.availableLocales, indexable: page.indexable});
}

export default async function TermsOfUsePage({params}: TermsOfUsePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const page = await termsPage(locale);

  return LegalPageShell({
    locale,
    pathname: `/${locale}/terms-of-use`,
    children: <LegalDocument content={page.content} />
  });
}

async function termsPage(locale: Locale) {
  try {
    return await getLegalPage('terms-of-use', locale);
  } catch (error) {
    if (error instanceof PageNotFoundError) notFound();
    throw error;
  }
}
