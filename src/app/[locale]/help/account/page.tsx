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

type AccountHelpPageProps = {
  params: Promise<{locale: string}>;
};

async function getLocale(params: AccountHelpPageProps['params']): Promise<Locale> {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({params}: AccountHelpPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const path = '/help/account';

  return {
    title: `${messages.accountHelp.title} | ${messages.site.name}`,
    description: messages.accountHelp.intro,
    alternates: {
      canonical: getLocalizedPath(locale, path),
      languages: getAlternates(path)
    },
    openGraph: {
      title: `${messages.accountHelp.title} | ${messages.site.name}`,
      description: messages.accountHelp.intro,
      locale: getOpenGraphLocale(locale),
      url: `${siteConfig.url}${getLocalizedPath(locale, path)}`,
      siteName: siteConfig.name,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function AccountHelpPage({params}: AccountHelpPageProps) {
  const locale = await getLocale(params);
  setRequestLocale(locale);
  const messages = getMessages(locale);
  const content = messages.accountHelp;
  const pathname = `/${locale}/help/account`;
  const accountSiteUrl = process.env.NEXT_PUBLIC_ACCOUNT_SITE_URL?.replace(/\/$/, '') ?? 'https://account.alive.org.tw';

  return (
    <>
      <SiteHeader locale={locale} pathname={pathname} />
      <main className="bg-[image:var(--hhc-page-gradient)] px-6 py-12 max-[620px]:px-4 max-[620px]:py-8">
        <article className="mx-auto w-full max-w-[880px]">
          <header className="border-b border-line pb-9">
            <p className="mb-3 text-sm font-bold text-primary">{content.eyebrow}</p>
            <h1 className="m-0 text-[42px] font-bold leading-tight text-ink max-[620px]:text-[34px]">{content.title}</h1>
            <p className="mt-5 max-w-[720px] text-lg leading-8 text-muted max-[620px]:text-base">{content.intro}</p>
          </header>

          <div className="grid grid-cols-2 gap-x-12 gap-y-10 py-10 max-[720px]:grid-cols-1">
            <AccountHelpSection title={content.purposeTitle} body={content.purposeBody} />
            <AccountHelpSection title={content.googleTitle} body={content.googleBody} />
            <AccountHelpSection title={content.otherProvidersTitle} body={content.otherProvidersBody} />
            <AccountHelpSection title={content.privacyTitle} body={content.privacyBody} />
          </div>

          <footer className="flex items-center justify-between gap-6 border-t border-line pt-8 max-[720px]:items-start max-[720px]:flex-col">
            <Button href={`${accountSiteUrl}/login`}>{content.signIn}</Button>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium text-muted">
              <Link className="hover:text-primary" href={`/${locale}/privacy-policy`}>{content.privacy}</Link>
              <Link className="hover:text-primary" href={`/${locale}/terms-of-use`}>{content.terms}</Link>
              <a className="hover:text-primary" href="mailto:support@alive.org.tw">{content.support}</a>
            </div>
          </footer>
        </article>
      </main>
      <SiteFooter locale={locale} pathname={pathname} />
    </>
  );
}

function AccountHelpSection({body, title}: {body: string; title: string}) {
  return (
    <section>
      <h2 className="m-0 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-3 leading-7 text-muted">{body}</p>
    </section>
  );
}
