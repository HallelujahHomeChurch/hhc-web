import type {Metadata} from 'next';
import {chenyuLuoyanBanner, inter, maShanZheng} from './fonts';
import {getThemeBootstrapScript} from '@hallelujahhomechurch/preferences';
import {LocaleDocument} from '@/components/layout/LocaleDocument';
import {getSiteLayout} from '@/features/site-layout/api';
import {siteConfig} from '@/lib/site';
import './globals.css';
import '@hallelujahhomechurch/ui/styles.css';

export async function generateMetadata(): Promise<Metadata> {
  const layout = await getSiteLayout('zh-Hant');
  return {
    metadataBase: new URL(siteConfig.url),
    title: layout.seoTitleSuffix,
    description: layout.seoDescriptionFallback,
    openGraph: {
      type: 'website',
      title: layout.seoTitleSuffix,
      description: layout.seoDescriptionFallback,
      siteName: layout.siteName,
      url: siteConfig.url,
      images: [{url: siteConfig.defaultOgImage, width: 1200, height: 630, alt: layout.siteName}]
    },
    twitter: {
      card: 'summary_large_image',
      title: layout.seoTitleSuffix,
      description: layout.seoDescriptionFallback,
      images: [siteConfig.defaultOgImage]
    }
  };
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <LocaleDocument suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: getThemeBootstrapScript()}} />
      </head>
      <body className={`${inter.variable} ${chenyuLuoyanBanner.variable} ${maShanZheng.variable}`}>{children}</body>
    </LocaleDocument>
  );
}
