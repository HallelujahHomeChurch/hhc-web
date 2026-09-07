import {getLocale} from 'next-intl/server';
import Link from 'next/link';
import {LegalPageShell} from '@/components/legal/LegalPageShell';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
export default async function NotFound() {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : 'zh-Hant';
  const messages = getMessages(locale);
  return LegalPageShell({locale, pathname: `/${locale}`, children: <section className="shell py-16 text-center"><h1 className="text-4xl font-semibold">404</h1><Link className="mt-6 inline-flex min-h-11 items-center text-primary" href={`/${locale}`}>{messages.site.nav.home}</Link></section>});
}
