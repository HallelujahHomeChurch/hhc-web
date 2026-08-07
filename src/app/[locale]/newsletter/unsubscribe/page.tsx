import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {UnsubscribePanel} from '@/components/newsletter/UnsubscribePanel';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

type UnsubscribePageProps = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{token?: string}>;
};

async function getLocale(params: UnsubscribePageProps['params']): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({params}: UnsubscribePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const messages = getMessages(locale);

  return {
    title: `${messages.newsletterUnsubscribe.title} | ${messages.site.name}`,
    robots: {index: false, follow: false}
  };
}

export default async function UnsubscribePage({params, searchParams}: UnsubscribePageProps) {
  const locale = await getLocale(params);
  const token = (await searchParams).token?.trim() ?? '';
  const messages = getMessages(locale);
  setRequestLocale(locale);

  return (
    <LegalPageShell
      languageLabel={messages.site.language}
      locale={locale}
      pathname={`/${locale}/newsletter/unsubscribe${token ? `?token=${encodeURIComponent(token)}` : ''}`}
      siteName={messages.site.name}
    >
      <UnsubscribePanel homeHref={`/${locale}`} labels={messages.newsletterUnsubscribe} token={token} />
    </LegalPageShell>
  );
}
