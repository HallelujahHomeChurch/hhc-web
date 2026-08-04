import type {Metadata} from 'next';
import Link from 'next/link';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {Button} from '@/components/ui/Button';
import {isLocale, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from '@/lib/seo';
import {siteConfig} from '@/lib/site';

type AccountInfoPageProps = {params: Promise<{locale: string}>};

async function getLocale(params: AccountInfoPageProps['params']): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({params}: AccountInfoPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const messages = getMessages(locale).accountApp;
  return {
    title: messages.title,
    description: messages.description,
    alternates: {canonical: getLocalizedPath(locale, '/account'), languages: getAlternates('/account')},
    openGraph: {
      title: messages.title,
      description: messages.description,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, '/account')}`,
      siteName: siteConfig.name,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function AccountInfoPage({params}: AccountInfoPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const pathname = `/${locale}/account`;

  return (
    <>
      <SiteHeader locale={locale} pathname={pathname} />
      <main className="bg-[image:var(--hhc-page-gradient)]">
        <section className="shell grid min-h-[520px] content-center gap-8 py-[clamp(64px,10vw,120px)]">
          <div className="max-w-[760px]">
            <p className="mb-3 text-base font-bold text-teal">{messages.accountApp.subtitle}</p>
            <h1 className="text-[clamp(42px,7vw,76px)] font-semibold leading-none text-ink">{messages.accountApp.title}</h1>
            <p className="mt-6 max-w-[680px] text-lg leading-[1.85] text-muted">{messages.accountApp.description}</p>
            <Button className="mt-7" href="https://account.alive.org.tw/login">{messages.accountApp.signIn}</Button>
          </div>
          <div className="grid max-w-[920px] grid-cols-2 gap-8 border-t border-line pt-8 max-[720px]:grid-cols-1">
            <div>
              <h2 className="mb-3 text-xl font-semibold text-ink">{messages.accountApp.featuresTitle}</h2>
              <p className="leading-7 text-muted">{messages.accountApp.accountFeature}</p>
            </div>
            <div>
              <h2 className="mb-3 text-xl font-semibold text-ink">Google Sign-In</h2>
              <p className="leading-7 text-muted">{messages.accountApp.googleFeature}</p>
            </div>
          </div>
          <nav className="flex gap-5 text-sm font-semibold" aria-label={messages.site.legalNavigation}>
            <Link className="text-primary hover:text-primary-hover" href={`/${locale}/privacy-policy`}>{messages.accountApp.privacy}</Link>
            <Link className="text-primary hover:text-primary-hover" href={`/${locale}/terms-of-use`}>{messages.accountApp.terms}</Link>
          </nav>
        </section>
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}
