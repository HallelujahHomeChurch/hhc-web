import {Inter} from 'next/font/google';
import localFont from 'next/font/local';
import type {Locale} from '@/i18n/locales';

export const inter = Inter({
  display: 'swap',
  preload: false,
  subsets: ['latin'],
  variable: '--font-inter',
  weight: 'variable'
});

export const maShanZheng = localFont({
  display: 'swap',
  preload: false,
  src: '../assets/fonts/ma-shan-zheng/MaShanZheng-HHC-Banners.woff2',
  variable: '--font-ma-shan-zheng',
  weight: '400'
});

export const chenyuLuoyanBanner = localFont({
  display: 'swap',
  preload: false,
  src: '../assets/fonts/chenyuluoyan/ChenYuluoyan-HHC-Banners.woff2',
  variable: '--font-chenyuluoyan',
  weight: '100 900'
});

export const kleeOneBanner = localFont({
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
  preload: false,
  src: '../assets/fonts/klee-one/KleeOne-HHC-Banners.woff2',
  variable: '--font-klee-one',
  weight: '400'
});

export const hhcPenHangulBanner = localFont({
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
  preload: false,
  src: '../assets/fonts/hhc-pen-hangul/HHC-Pen-Hangul-Banners.woff2',
  variable: '--font-hhc-pen-hangul',
  weight: '400'
});

export const bannerFontByLocale = {
  'zh-Hant': chenyuLuoyanBanner,
  'zh-Hans': maShanZheng,
  en: chenyuLuoyanBanner,
  ja: kleeOneBanner,
  ko: hhcPenHangulBanner
} satisfies Record<Locale, {className: string}>;
