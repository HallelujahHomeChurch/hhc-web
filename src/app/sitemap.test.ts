import {describe, expect, it} from 'vitest';
import {buildNewsSitemap} from './sitemap';

describe('news sitemap', () => {
  it('adds one canonical entry per locale', () => {
    const entries = buildNewsSitemap([{
      id: 'news-1', title: 'News', summary: '', date: '', imageAlt: 'News', href: '/zh-Hant/news/announcement'
    }]);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.url)).toContain('https://www.alive.org.tw/en/news/announcement');
  });
});
