import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {getSiteLayout} from '@/features/site-layout/api';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

type MaintenancePageProps = {
  params: Promise<{locale: string}>;
};

async function getLocale(params: MaintenancePageProps['params']): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

export async function generateMetadata({params}: MaintenancePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);

  return {
    title: `${messages.maintenance.title} | ${layout.seoTitleSuffix}`,
    description: messages.maintenance.description,
    robots: {index: false, follow: false}
  };
}

export default async function MaintenancePage({params}: MaintenancePageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const layout = await getSiteLayout(locale);

  return (
    <LegalPageShell
      languageLabel={messages.site.language}
      locale={locale}
      pathname={`/${locale}/maintenance`}
      siteName={layout.siteName}
    >
      <section className="maintenance-status" aria-labelledby="maintenance-title">
        <h1 id="maintenance-title">{messages.maintenance.title}</h1>
        <p>{messages.maintenance.description}</p>
      </section>
    </LegalPageShell>
  );
}
