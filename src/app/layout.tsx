import type {Metadata} from 'next';
import {chenyuLuoyanBanner, inter, maShanZheng} from './fonts';
import {getThemeBootstrapScript} from '@hallelujahhomechurch/preferences';
import {LocaleDocument} from '@/components/layout/LocaleDocument';
import {siteConfig} from '@/lib/site';
import './globals.css';
import '@hallelujahhomechurch/ui/styles.css';

export const metadata: Metadata = {metadataBase: new URL(siteConfig.url), title: siteConfig.name};

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
