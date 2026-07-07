import type {Metadata} from 'next';
import {inter, notoSansSC, notoSansTC} from './fonts';
import {defaultLocale} from '@/i18n/locales';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: '哈利路亞家教會',
  description: '哈利路亞家教會官網'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang={defaultLocale}>
      <body className={`${inter.variable} ${notoSansTC.variable} ${notoSansSC.variable}`}>{children}</body>
    </html>
  );
}
