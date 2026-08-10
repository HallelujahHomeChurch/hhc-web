import {Inter} from 'next/font/google';
import localFont from 'next/font/local';

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
