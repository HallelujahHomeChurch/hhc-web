import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import type {SiteExternalLinks, SiteLayout} from './types';

const fallbackLinks: SiteExternalLinks = {
  churchYoutube: 'https://youtube.com/@hhc33?si=SR2rSIVOTFX2dCmw',
  churchFacebook: 'https://www.facebook.com/www.alive.org.tw/?locale=zh_TW',
  musicYoutube: 'https://youtube.com/@gkpmusic777?si=JqJyfjM8FCmWD5MY'
};

export async function getSiteLayout(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<SiteLayout> {
  try {
    const home = await client.getPublicPage('home', locale);
    if (home.pageKey === 'home' && home.template === 'home.v2' && home.content.template === 'home.v2' && home.routePath === '/' && home.resolvedLocale === locale && home.availableLocales.includes(locale)) {
      return configuredLayout(locale, home.content.data.links, home.version, home.publishedAt);
    }
  } catch {
    return legacyLayout(locale, client);
  }
  return legacyLayout(locale, client);
}

async function legacyLayout(locale: Locale, client: HhcWebClient): Promise<SiteLayout> {
  try {
    return await client.getSiteLayout(locale);
  } catch {
    return configuredLayout(locale, fallbackLinks, 0, '');
  }
}

function configuredLayout(locale: Locale, links: SiteExternalLinks, version: number, publishedAt: string): SiteLayout {
  const {home, site} = getMessages(locale);
  return {
    locale,
    siteName: site.name,
    englishName: site.englishName,
    copyrightHolder: site.copyrightHolder,
    allRightsReserved: site.allRightsReserved,
    seoTitleSuffix: site.name,
    seoDescriptionFallback: home.heroSubtitle,
    header: [
      {key: 'about', label: site.nav.about, href: `/${locale}/about`, visible: true},
      {key: 'news', label: site.nav.news, href: `/${locale}/news`, visible: true},
      {key: 'literature-ministry', label: site.nav.literatureMinistry, href: `/${locale}/literature-ministry`, visible: true}
    ],
    legal: [
      {key: 'privacy-policy', label: site.privacyPolicy, href: `/${locale}/privacy-policy`, visible: true},
      {key: 'terms-of-use', label: site.termsOfUse, href: `/${locale}/terms-of-use`, visible: true}
    ],
    links,
    version,
    publishedAt
  };
}
