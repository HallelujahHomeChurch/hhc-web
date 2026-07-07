import {NextIntlClientProvider} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale, locales, type Locale} from '@/i18n/locales';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({locale}));
}

export const dynamicParams = false;

async function getMessages(locale: Locale) {
  return (await import(`../../i18n/locales/${locale}.json`)).default;
}

export default async function LocaleLayout({children, params}: LocaleLayoutProps) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);

  return (
    <NextIntlClientProvider locale={rawLocale} messages={await getMessages(rawLocale)}>
      <div data-locale={rawLocale}>{children}</div>
    </NextIntlClientProvider>
  );
}
