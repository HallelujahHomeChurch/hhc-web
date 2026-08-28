import type {Metadata} from 'next';
import Image from 'next/image';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {localeMetadata} from '@/i18n/locales';
import {getSiteLayout} from '@/features/site-layout/api';
import {resolveRootLocale} from '@/lib/root-locale';
import {getAlternates} from '@/lib/seo';
import {siteConfig} from '@/lib/site';
import {organizationStructuredData, serializeJsonLd} from '@/lib/structured-data';

export const dynamic = 'force-dynamic';

const description = '繁體中文・简体中文・English・日本語・한국어';

export async function generateMetadata(): Promise<Metadata> {
  const layout = await getSiteLayout('zh-Hant');
  return {
    title: layout.seoTitleSuffix,
    description: layout.seoDescriptionFallback,
    alternates: {
      canonical: '/',
      languages: getAlternates('/')
    },
    openGraph: {
      type: 'website',
      title: layout.seoTitleSuffix,
      description: layout.seoDescriptionFallback,
      url: `${siteConfig.url}/`,
      siteName: layout.siteName,
      images: [siteConfig.defaultOgImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: layout.seoTitleSuffix,
      description: layout.seoDescriptionFallback,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default async function RootPage() {
  const requestHeaders = await headers();
  const locale = resolveRootLocale(
    requestHeaders.get('cookie') ?? '',
    requestHeaders.get('accept-language') ?? ''
  );

  if (locale) redirect(`/${locale}`);

  const layout = await getSiteLayout('zh-Hant');
  const rootStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        url: `${siteConfig.url}/`,
        name: layout.siteName,
        alternateName: [
          '哈利路亞家教會',
          '哈利路亚家教会',
          'Hallelujah Home Church',
          'ハレルヤ・ホームチャーチ',
          '할렐루야 가정교회'
        ]
      },
      organizationStructuredData(layout.links)
    ]
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[image:var(--hhc-page-gradient)] px-5 py-10">
      <section className="w-full max-w-[620px] rounded-[28px] border border-line/80 bg-paper/90 px-6 py-9 text-center shadow-warm backdrop-blur-sm sm:px-10 sm:py-12" aria-labelledby="language-entry-title">
        <Image className="mx-auto size-20 object-contain" src="/assets/brand/logo.png" alt="" width={80} height={80} priority />
        <h1 id="language-entry-title" className="mt-5 text-[clamp(42px,10vw,68px)] font-semibold tracking-[0.12em] text-[var(--hhc-brand-strong)]">HHC</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        <nav className="mt-8" aria-label="Language">
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
            {localeMetadata.map(({code, nativeLabel}) => (
              <li key={code}>
                <a
                  className="flex min-h-14 items-center justify-center rounded-2xl border border-line bg-panel px-5 text-base font-semibold text-ink transition hover:border-primary hover:bg-primary-soft hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  href={`/${code}`}
                  hrefLang={code}
                  lang={code}
                >
                  {nativeLabel}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(rootStructuredData)}}
      />
    </main>
  );
}
