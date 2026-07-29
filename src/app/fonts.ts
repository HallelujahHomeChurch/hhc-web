import {Inter, Noto_Sans_SC, Noto_Sans_TC} from 'next/font/google';
import localFont from 'next/font/local';

export const inter = Inter({
  display: 'block',
  preload: true,
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900']
});

export const notoSansTC = Noto_Sans_TC({
  display: 'block',
  preload: true,
  subsets: ['latin'],
  variable: '--font-noto-sans-tc',
  weight: ['400', '500', '600', '700', '800', '900']
});

export const notoSansSC = Noto_Sans_SC({
  display: 'block',
  preload: true,
  subsets: ['latin'],
  variable: '--font-noto-sans-sc',
  weight: ['400', '500', '600', '700', '800', '900']
});

export const chenyuLuoyan = localFont({
  display: 'block',
  preload: true,
  src: '../assets/fonts/chenyuluoyan/ChenYuluoyan-2.0-Thin.woff2',
  variable: '--font-chenyuluoyan',
  weight: '100 900'
});
