import type {Metadata} from 'next';
import {chenyuLuoyanBanner, inter, maShanZheng, notoSansSC, notoSansTC} from './fonts';
import {defaultLocale} from '@/i18n/locales';
import {getThemeBootstrapScript} from '@hallelujahhomechurch/preferences';
import {siteConfig} from '@/lib/site';
import './globals.css';
import '@hallelujahhomechurch/ui/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: '哈利路亞家教會',
  description: '哈利路亞家教會官網',
  openGraph: {
    type: 'website',
    title: '哈利路亞家教會',
    description: '在愛中建造家庭，在真理中成長',
    siteName: siteConfig.name,
    url: siteConfig.url,
    images: [{url: siteConfig.defaultOgImage, width: 1200, height: 630, alt: siteConfig.name}]
  },
  twitter: {
    card: 'summary_large_image',
    title: '哈利路亞家教會',
    description: '在愛中建造家庭，在真理中成長',
    images: [siteConfig.defaultOgImage]
  }
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: getThemeBootstrapScript()}} />
      </head>
      <body className={`${inter.variable} ${notoSansTC.variable} ${notoSansSC.variable} ${chenyuLuoyanBanner.variable} ${maShanZheng.variable}`}>{children}</body>
    </html>
  );
}
