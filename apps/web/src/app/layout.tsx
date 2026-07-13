import type {Metadata} from 'next';
import {chenyuLuoyan, inter, notoSansSC, notoSansTC} from './fonts';
import {defaultLocale} from '@/i18n/locales';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: '哈利路亞家教會',
  description: '哈利路亞家教會官網'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{const m=document.cookie.match(/(?:^|;\\s*)hhc_theme=(light|dark)(?:;|$)/);const t=m?.[1]??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t})()`
          }}
        />
      </head>
      <body className={`${inter.variable} ${notoSansTC.variable} ${notoSansSC.variable} ${chenyuLuoyan.variable}`}>{children}</body>
    </html>
  );
}
