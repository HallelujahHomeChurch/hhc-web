import {NextIntlClientProvider} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale, productLocales, type Locale} from '@/i18n/locales';
import {TranslationNotice} from '@/components/layout/TranslationNotice';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return productLocales.map((locale) => ({locale}));
}

export const dynamicParams = false;

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
      <div data-locale={rawLocale} lang={rawLocale}>
        <TranslationNotice locale={rawLocale} message={messages.site.translationNotice} dismissLabel={messages.site.translationNoticeDismiss} regionLabel={messages.site.translationNoticeRegion} />
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
