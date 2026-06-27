import {describe, expect, it} from 'vitest';
import {getAlternates, getLocalizedPath, getOpenGraphLocale} from './seo';

describe('seo utilities', () => {
  it('builds locale-prefixed paths', () => {
    expect(getLocalizedPath('zh-Hant', '/about')).toBe('/zh-Hant/about');
    expect(getLocalizedPath('en', '/')).toBe('/en');
  });

  it('builds alternates for every locale', () => {
    expect(getAlternates('/about')).toEqual({
      'zh-Hant': 'https://example.com/zh-Hant/about',
      'zh-Hans': 'https://example.com/zh-Hans/about',
      en: 'https://example.com/en/about'
    });
  });

  it('maps locales to Open Graph locales', () => {
    expect(getOpenGraphLocale('zh-Hant')).toBe('zh_TW');
    expect(getOpenGraphLocale('zh-Hans')).toBe('zh_CN');
    expect(getOpenGraphLocale('en')).toBe('en_US');
  });
});
