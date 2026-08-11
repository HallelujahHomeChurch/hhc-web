import {describe, expect, it, vi} from 'vitest';
import sitemap, {buildNewsSitemap} from './sitemap';

vi.mock('@/features/news/api', () => ({getNewsPage: vi.fn(async () => ({items: []}))}));

describe('static sitemap', () => {
  it('publishes every static route in all five locales', async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(35);
    expect(entries.map((entry) => entry.url).slice(0, 5)).toEqual([
      'https://www.alive.org.tw/zh-Hant',
      'https://www.alive.org.tw/zh-Hans',
      'https://www.alive.org.tw/en',
      'https://www.alive.org.tw/ja',
      'https://www.alive.org.tw/ko'
    ]);
    expect(entries.find((entry) => entry.url === 'https://www.alive.org.tw/ja/privacy-policy')?.alternates?.languages).toMatchObject({
      ja: 'https://www.alive.org.tw/ja/privacy-policy',
      ko: 'https://www.alive.org.tw/ko/privacy-policy'
    });
  });
});

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
