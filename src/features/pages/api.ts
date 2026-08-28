import type {HhcWebClient, PageContent, PublicEditorialPage} from '@hallelujahhomechurch/hhc-web-client';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {publicContentClient} from '@/features/content/client';
import {productLocales, type Locale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';

type HomeContent = Extract<PageContent, {template: 'home.v1'}>['data'];
type AboutContent = Extract<PageContent, {template: 'about.v1'}>['data'];
type LegalPageData = Extract<PageContent, {template: 'legal.v1'}>['data'];
type LegalContent = Omit<LegalPageData, 'heroSubtitle'> & {heroSubtitle: string};
type PageResult<T> = {
  content: T;
  availableLocales: Locale[];
  indexable: boolean;
  source: 'cms' | 'migration-fallback';
};

export class PageNotFoundError extends Error {}
export class PageProjectionError extends Error {}

export function isPageAvailabilityError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof HhcWebApiError && error.status >= 500 && error.status < 600);
}

export async function getHomePage(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<PageResult<HomeContent>> {
  let page: PublicEditorialPage;
  try {
    page = await requestPage('home', locale, client);
  } catch (error) {
    if (isPageAvailabilityError(error)) return migrationHome(locale);
    throw error;
  }
  assertPage(page, locale, 'home', 'home.v1', '/');
  if (page.content.template !== 'home.v1') throw new PageProjectionError('Home page content template mismatch.');
  return result(page, page.content.data);
}

export async function getAboutPage(locale: Locale, client: HhcWebClient = publicContentClient()): Promise<PageResult<AboutContent>> {
  let page: PublicEditorialPage;
  try {
    page = await requestPage('about', locale, client);
  } catch (error) {
    if (isPageAvailabilityError(error)) return migrationAbout(locale);
    throw error;
  }
  assertPage(page, locale, 'about', 'about.v1', '/about');
  if (page.content.template !== 'about.v1') throw new PageProjectionError('About page content template mismatch.');
  return result(page, page.content.data);
}

export async function getLegalPage(key: 'privacy-policy' | 'terms-of-use', locale: Locale, client: HhcWebClient = publicContentClient()): Promise<PageResult<LegalContent>> {
  const route = key === 'privacy-policy' ? '/privacy-policy' : '/terms-of-use';
  const page = await requestPage(key, locale, client);
  assertPage(page, locale, key, 'legal.v1', route);
  if (page.content.template !== 'legal.v1') throw new PageProjectionError('Legal page content template mismatch.');
  return result(page, {...page.content.data, heroSubtitle: page.content.data.heroSubtitle ?? ''});
}

async function requestPage(key: PublicEditorialPage['pageKey'], locale: Locale, client: HhcWebClient) {
  try {
    return await client.getPublicPage(key, locale);
  } catch (error) {
    if (error instanceof HhcWebApiError && error.status === 404) throw new PageNotFoundError(`${key} is not published in ${locale}.`);
    throw error;
  }
}

function assertPage(page: PublicEditorialPage, locale: Locale, key: PublicEditorialPage['pageKey'], template: PublicEditorialPage['template'], routePath: PublicEditorialPage['routePath']) {
  if (page.resolvedLocale !== locale || !page.availableLocales.includes(locale)) throw new PageProjectionError(`${key} projection locale mismatch.`);
  if (page.pageKey !== key || page.template !== template || page.routePath !== routePath || page.content.template !== template) throw new PageProjectionError(`${key} projection metadata mismatch.`);
}

function result<T>(page: PublicEditorialPage, content: T): PageResult<T> {
  return {content, availableLocales: [...page.availableLocales], indexable: page.indexable, source: 'cms'};
}

function migrationHome(locale: Locale): PageResult<HomeContent> {
  const home = getMessages(locale).home;
  return {source: 'migration-fallback', indexable: true, availableLocales: [...productLocales], content: {
    heroTitle: home.heroTitle, heroSubtitle: home.heroSubtitle, newsTitle: home.newsTitle, moreNews: home.moreNews,
    weeklyTitle: home.weeklyTitle, downloadWeekly: home.downloadWeekly, videosTitle: home.videosTitle,
    videosSubtitle: home.videosSubtitle, watchMore: home.watchMore, aboutTitle: home.aboutTitle,
    aboutBody: home.aboutBody, aboutCta: home.aboutCta, locationsTitle: home.locationsTitle, mapLink: home.mapLink
  }};
}

function migrationAbout(locale: Locale): PageResult<AboutContent> {
  const about = getMessages(locale).about;
  return {source: 'migration-fallback', indexable: true, availableLocales: [...productLocales], content: {
    heroTitle: about.heroTitle,
    heroSubtitle: about.heroSubtitle,
    vision: about.vision,
    history: about.history
  } as AboutContent};
}
