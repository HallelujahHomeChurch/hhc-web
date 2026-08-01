import type {Metadata} from 'next';
import {chenyuLuoyan, inter, maShanZheng, notoSansSC, notoSansTC} from './fonts';
import {defaultLocale} from '@/i18n/locales';
import {getThemeBootstrapScript} from '@hallelujahhomechurch/preferences';
import {siteConfig} from '@/lib/site';
import './globals.css';
import '@hallelujahhomechurch/ui/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: '哈利路亞家教會',
  description: '哈利路亞家教會官網'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeBootstrapScript()
          }}
        />
      </head>
      <body className={`${inter.variable} ${notoSansTC.variable} ${notoSansSC.variable} ${chenyuLuoyan.variable} ${maShanZheng.variable}`}>{children}</body>
    </html>
  );
}
