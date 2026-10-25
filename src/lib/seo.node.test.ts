import {describe, expect, it} from 'vitest';
import {getAlternates, getEditorialMetadata, getLocalizedPath, getOpenGraphLocale} from './seo';

describe('seo utilities', () => {
  it('builds locale-prefixed paths', () => {
    expect(getLocalizedPath('zh-Hant', '/about')).toBe('/zh-Hant/about');
    expect(getLocalizedPath('en', '/')).toBe('/en');
  });

  it('builds alternates for every locale', () => {
    expect(getAlternates('/about')).toEqual({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant/about',
      'zh-Hans': 'https://www.alive.org.tw/zh-Hans/about',
      en: 'https://www.alive.org.tw/en/about',
      ja: 'https://www.alive.org.tw/ja/about',
      ko: 'https://www.alive.org.tw/ko/about'
    });
  });

  it('uses the bare domain as x-default only for home pages', () => {
    expect(getAlternates('/')).toMatchObject({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant',
      ja: 'https://www.alive.org.tw/ja',
      ko: 'https://www.alive.org.tw/ko',
      'x-default': 'https://www.alive.org.tw/'
    });
    expect(getAlternates('/about')).not.toHaveProperty('x-default');
  });

  it('maps locales to Open Graph locales', () => {
    expect(getOpenGraphLocale('zh-Hant')).toBe('zh_TW');
    expect(getOpenGraphLocale('zh-Hans')).toBe('zh_CN');
    expect(getOpenGraphLocale('en')).toBe('en_US');
    expect(getOpenGraphLocale('ja')).toBe('ja_JP');
    expect(getOpenGraphLocale('ko')).toBe('ko_KR');
  });

  it('limits editorial hreflang and Open Graph alternates to published locales', () => {
    const metadata = getEditorialMetadata({
      locale: 'ja', path: '/about', title: 'CMS About', description: 'CMS summary', siteName: 'CMS Site',
      availableLocales: ['zh-Hant', 'ja'], indexable: true
    });

    expect(metadata.alternates?.languages).toEqual({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant/about',
      ja: 'https://www.alive.org.tw/ja/about'
    });
    expect(metadata.openGraph).toMatchObject({locale: 'ja_JP', alternateLocale: ['zh_TW']});
  });

  it('omits discoverability metadata for a non-indexable editorial page', () => {
    const metadata = getEditorialMetadata({
      locale: 'en', path: '/terms-of-use', title: 'Terms', description: 'Terms summary', siteName: 'CMS Site',
      availableLocales: ['en'], indexable: false
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toMatchObject({index: false});
    expect(metadata.openGraph).toMatchObject({alternateLocale: []});
  });
});
