import {Inter, Ma_Shan_Zheng, Noto_Sans_SC, Noto_Sans_TC} from 'next/font/google';
import localFont from 'next/font/local';

export const inter = Inter({
  display: 'swap',
  preload: false,
  subsets: ['latin'],
  variable: '--font-inter',
  weight: 'variable'
});

export const notoSansTC = Noto_Sans_TC({
  display: 'swap',
  preload: false,
  subsets: ['latin'],
  variable: '--font-noto-sans-tc',
  weight: 'variable'
});

export const notoSansSC = Noto_Sans_SC({
  display: 'swap',
  preload: false,
  subsets: ['latin'],
  variable: '--font-noto-sans-sc',
  weight: 'variable'
});

export const maShanZheng = Ma_Shan_Zheng({
  display: 'swap',
  preload: false,
  variable: '--font-ma-shan-zheng',
  weight: '400'
});

export const chenyuLuoyanBanner = localFont({
  display: 'swap',
  preload: true,
  src: '../assets/fonts/chenyuluoyan/ChenYuluoyan-HHC-Banners.woff2',
  variable: '--font-chenyuluoyan',
  weight: '100 900'
});
