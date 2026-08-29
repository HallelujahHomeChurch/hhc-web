import type {Locale} from '@/i18n/locales';

export type SiteExternalLinks = {
  churchYoutube: string;
  churchFacebook: string;
  musicYoutube: string;
};

export type SiteLayout = {
  locale: Locale;
  siteName: string;
  englishName: string;
  copyrightHolder: string;
  allRightsReserved: string;
  seoTitleSuffix: string;
  seoDescriptionFallback: string;
  header: Array<{key: 'about' | 'news' | 'literature-ministry'; label: string; href: string; visible: boolean}>;
  legal: Array<{key: 'privacy-policy' | 'terms-of-use'; label: string; href: string; visible: boolean}>;
  links: SiteExternalLinks;
  version: number;
  publishedAt: string;
};
