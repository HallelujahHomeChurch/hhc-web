import type {HhcWebClient, SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import type {Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

export async function getSiteLayout(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<SiteLayout> {
  try {
    return await client.getSiteLayout(locale);
  } catch {
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
      links: {
        churchYoutube: 'https://youtube.com/@hhc33?si=SR2rSIVOTFX2dCmw',
        churchFacebook: 'https://www.facebook.com/www.alive.org.tw/?locale=zh_TW',
        musicYoutube: 'https://youtube.com/@gkpmusic777?si=JqJyfjM8FCmWD5MY'
      },
      version: 0,
      publishedAt: ''
    };
  }
}
