import type {HhcWebClient, PageContent, PublicEditorialPage} from '@hallelujahhomechurch/hhc-web-client';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {describe, expect, it} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {productLocales, type Locale} from '@/i18n/locales';
import {getAboutPage, getHomePage, getLegalPage, PageNotFoundError, PageProjectionError} from './api';

describe('fixed editorial page adapters', () => {
  it.each(productLocales)('maps the exact %s Home projection to the approved current keys', async (locale) => {
    const content = homeContent(locale);
    const page = await getHomePage(locale, clientWith(pageFixture('home', locale, content)));

    expect(page).toMatchObject({content: content.data, availableLocales: productLocales, indexable: true, source: 'cms'});
  });

  it.each(productLocales)('maps the exact %s About projection to unchanged component props', async (locale) => {
    const content = aboutContent(locale);
    const page = await getAboutPage(locale, clientWith(pageFixture('about', locale, content)));

    expect(page).toMatchObject({content: content.data, availableLocales: productLocales, source: 'cms'});
  });

  it.each(productLocales)('maps the exact %s legal projections without static fallback', async (locale) => {
    const content = legalContent(locale, 'privacy-policy');
    const page = await getLegalPage('privacy-policy', locale, clientWith(pageFixture('privacy-policy', locale, content)));

    expect(page).toMatchObject({content: content.data, availableLocales: productLocales, source: 'cms'});
  });

  it('fails closed on a key, route, or template mismatch', async () => {
    const mismatch = {...pageFixture('home', 'en', homeContent('en')), template: 'about.v1'} as PublicEditorialPage;

    await expect(getHomePage('en', clientWith(mismatch))).rejects.toBeInstanceOf(PageProjectionError);
  });

  it('treats a non-exact locale response and a 404 as not found instead of falling back', async () => {
    const fallbackLocale = {...pageFixture('home', 'en', homeContent('en')), resolvedLocale: 'zh-Hant' as const};
    await expect(getHomePage('en', clientWith(fallbackLocale))).rejects.toBeInstanceOf(PageNotFoundError);
    await expect(getAboutPage('en', rejectingClient(new HhcWebApiError(404, 'not_found', 'missing')))).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it.each([
    new TypeError('network unavailable'),
    new HhcWebApiError(503, 'service_unavailable', 'unavailable')
  ])('uses migration-only static fallback for Home and About availability failures: %s', async (error) => {
    const client = rejectingClient(error);

    await expect(getHomePage('ja', client)).resolves.toMatchObject({content: homeContent('ja').data, source: 'migration-fallback'});
    await expect(getAboutPage('ko', client)).resolves.toMatchObject({content: aboutContent('ko').data, source: 'migration-fallback'});
  });

  it.each([
    new HhcWebApiError(200, 'invalid_response', 'invalid response'),
    new HhcWebApiError(403, 'forbidden', 'forbidden'),
    new Error('plain failure')
  ])('fails loud instead of falling back for non-availability failures: %s', async (error) => {
    await expect(getHomePage('ja', rejectingClient(error))).rejects.toBe(error);
    await expect(getAboutPage('ko', rejectingClient(error))).rejects.toBe(error);
  });

  it('never falls back for Legal availability failures', async () => {
    await expect(getLegalPage('terms-of-use', 'en', rejectingClient(new TypeError('network unavailable')))).rejects.toThrow('network unavailable');
  });

  it('preserves only the API published/indexable locale membership', async () => {
    const fixture = {...pageFixture('about', 'ja', aboutContent('ja')), indexable: false, availableLocales: ['zh-Hant', 'ja'] as Locale[]};

    await expect(getAboutPage('ja', clientWith(fixture))).resolves.toMatchObject({indexable: false, availableLocales: ['zh-Hant', 'ja']});
  });
});

function clientWith(page: PublicEditorialPage) {
  return {getPublicPage: async () => page} as unknown as HhcWebClient;
}

function rejectingClient(error: Error) {
  return {getPublicPage: async () => Promise.reject(error)} as unknown as HhcWebClient;
}

function pageFixture(pageKey: PublicEditorialPage['pageKey'], locale: Locale, content: PageContent): PublicEditorialPage {
  const metadata = {
    home: {template: 'home.v1', routePath: '/'},
    about: {template: 'about.v1', routePath: '/about'},
    'privacy-policy': {template: 'legal.v1', routePath: '/privacy-policy'},
    'terms-of-use': {template: 'legal.v1', routePath: '/terms-of-use'}
  } as const;
  return {pageKey, ...metadata[pageKey], indexable: true, content, resolvedLocale: locale, availableLocales: [...productLocales], version: 3, publishedAt: '2026-08-29T00:00:00Z'};
}

function homeContent(locale: Locale): Extract<PageContent, {template: 'home.v1'}> {
  const home = getMessages(locale).home;
  return {schemaVersion: 1, template: 'home.v1', data: {
    heroTitle: home.heroTitle, heroSubtitle: home.heroSubtitle, newsTitle: home.newsTitle, moreNews: home.moreNews,
    weeklyTitle: home.weeklyTitle, downloadWeekly: home.downloadWeekly, videosTitle: home.videosTitle,
    videosSubtitle: home.videosSubtitle, watchMore: home.watchMore, aboutTitle: home.aboutTitle,
    aboutBody: home.aboutBody, aboutCta: home.aboutCta, locationsTitle: home.locationsTitle, mapLink: home.mapLink
  }};
}

function aboutContent(locale: Locale): Extract<PageContent, {template: 'about.v1'}> {
  const about = getMessages(locale).about;
  return {schemaVersion: 1, template: 'about.v1', data: {heroTitle: about.heroTitle, heroSubtitle: about.heroSubtitle, vision: about.vision, history: about.history}};
}

function legalContent(locale: Locale, key: 'privacy-policy' | 'terms-of-use'): Extract<PageContent, {template: 'legal.v1'}> {
  const content = getMessages(locale)[key === 'privacy-policy' ? 'privacyPolicy' : 'termsOfUse'];
  return {schemaVersion: 1, template: 'legal.v1', data: content};
}
