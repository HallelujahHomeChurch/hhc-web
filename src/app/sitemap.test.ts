import {beforeEach, describe, expect, it, vi} from 'vitest';
import {PageNotFoundError, PageProjectionError} from '@/features/pages/api';
import sitemap, {buildNewsSitemap} from './sitemap';

vi.mock('@/features/news/api', () => ({getNewsPage: vi.fn(async () => ({items: []}))}));
const pageMocks = vi.hoisted(() => ({
  home: vi.fn(),
  about: vi.fn(),
  legal: vi.fn()
}));
vi.mock('@/features/pages/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/pages/api')>(),
  getHomePage: pageMocks.home,
  getAboutPage: pageMocks.about,
  getLegalPage: pageMocks.legal
}));

describe('static sitemap', () => {
  beforeEach(() => {
    pageMocks.home.mockReset().mockResolvedValue(fixedPage(['zh-Hant', 'en']));
    pageMocks.about.mockReset().mockResolvedValue(fixedPage(['ja']));
    pageMocks.legal.mockReset().mockImplementation(async (key: string) => key === 'privacy-policy' ? fixedPage(['zh-Hant', 'ja']) : fixedPage(['en'], false));
  });

  it('publishes fixed routes only for API published/indexable locales', async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(20);
    expect(entries.map((entry) => entry.url)).toContain('https://www.alive.org.tw/zh-Hant');
    expect(entries.map((entry) => entry.url)).toContain('https://www.alive.org.tw/en');
    expect(entries.map((entry) => entry.url)).not.toContain('https://www.alive.org.tw/ja');
    expect(entries.map((entry) => entry.url)).toContain('https://www.alive.org.tw/ja/about');
    expect(entries.find((entry) => entry.url === 'https://www.alive.org.tw/zh-Hant')?.alternates?.languages).toMatchObject({
      'x-default': 'https://www.alive.org.tw/'
    });
    expect(entries.find((entry) => entry.url === 'https://www.alive.org.tw/ja/privacy-policy')?.alternates?.languages).toMatchObject({
      ja: 'https://www.alive.org.tw/ja/privacy-policy',
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant/privacy-policy'
    });
    expect(entries.map((entry) => entry.url)).not.toContain('https://www.alive.org.tw/ko/privacy-policy');
    expect(entries.some((entry) => entry.url.endsWith('/terms-of-use'))).toBe(false);
    expect(entries.find((entry) => entry.url === 'https://www.alive.org.tw/ja/privacy-policy')?.alternates?.languages).not.toHaveProperty('x-default');
  });

  it('omits only a fixed route whose CMS projection is unavailable', async () => {
    pageMocks.home.mockRejectedValueOnce(new TypeError('network unavailable'));

    const entries = await sitemap();

    expect(entries).toHaveLength(18);
    expect(entries.some((entry) => entry.url === 'https://www.alive.org.tw/zh-Hant')).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith('/about'))).toBe(true);
  });

  it('omits only a fixed route that is not published', async () => {
    pageMocks.home.mockRejectedValueOnce(new PageNotFoundError('home is not published'));

    const entries = await sitemap();

    expect(entries).toHaveLength(18);
    expect(entries.some((entry) => entry.url === 'https://www.alive.org.tw/zh-Hant')).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith('/about'))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith('/privacy-policy'))).toBe(true);
  });

  it('fails loud when fixed-page projection data is corrupt', async () => {
    pageMocks.home.mockRejectedValueOnce(new PageProjectionError('corrupt projection'));

    await expect(sitemap()).rejects.toThrow('corrupt projection');
  });
});

function fixedPage(availableLocales: ('zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko')[], indexable = true) {
  return {source: 'cms', availableLocales, indexable, content: {}};
}

describe('news sitemap', () => {
  it('adds one canonical entry per locale', () => {
    const entries = buildNewsSitemap([{
      id: 'news-1', title: 'News', requestedLocale: 'ja', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en'],
      summary: '', date: '', imageAlt: 'News', href: '/zh-Hant/news/announcement'
    }]);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.url)).toContain('https://www.alive.org.tw/zh-Hant/news/announcement');
    expect(entries.map((entry) => entry.url)).toContain('https://www.alive.org.tw/en/news/announcement');
    expect(entries.map((entry) => entry.url)).not.toContain('https://www.alive.org.tw/ja/news/announcement');
    expect(entries[0].alternates?.languages).toEqual({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant/news/announcement',
      en: 'https://www.alive.org.tw/en/news/announcement'
    });
  });

  it('adds Japanese only for an exact published Japanese projection', () => {
    const entries = buildNewsSitemap([{
      id: 'news-ja', title: 'お知らせ', requestedLocale: 'ja', resolvedLocale: 'ja', availableLocales: ['zh-Hant', 'ja'],
      summary: '', date: '', imageAlt: 'カバー', href: '/ja/news/announcement'
    }]);

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://www.alive.org.tw/zh-Hant/news/announcement',
      'https://www.alive.org.tw/ja/news/announcement'
    ]);
    expect(entries[0].alternates?.languages).toEqual({
      'zh-Hant': 'https://www.alive.org.tw/zh-Hant/news/announcement',
      ja: 'https://www.alive.org.tw/ja/news/announcement'
    });
  });
});
