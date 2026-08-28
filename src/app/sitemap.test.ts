import {describe, expect, it, vi} from 'vitest';
import sitemap, {buildNewsSitemap} from './sitemap';

vi.mock('@/features/news/api', () => ({getNewsPage: vi.fn(async () => ({items: []}))}));
vi.mock('@/features/pages/api', () => ({
  getHomePage: vi.fn(async () => fixedPage(['zh-Hant', 'en'])),
  getAboutPage: vi.fn(async () => fixedPage(['ja'])),
  getLegalPage: vi.fn(async (key: string) => key === 'privacy-policy' ? fixedPage(['zh-Hant', 'ja']) : fixedPage(['en'], false))
}));

describe('static sitemap', () => {
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
