import {describe, expect, it, vi} from 'vitest';
import {fetchLatestWeekly, fetchWeeklyArchive} from './public-api';

describe('weekly public api', () => {
  it('returns the latest issue with all valid editions and no product-locale argument', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{issueNumber: 1732, issueDate: '2026-07-13', versions: ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant'].map((locale) => ({
        issueDate: '2026-07-13', locale, title: `${locale} title`,
        downloadUrl: `/api/assets/public/${locale}`, publishedAt: '2026-07-13T04:00:00Z', version: 3
      }))}],
      meta: {page: 1, pageSize: 1, total: 1}, error: null
    }), {status: 200}));
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchLatestWeekly()).resolves.toMatchObject({
      issueNumber: 1732,
      versions: [
        {locale: 'zh-Hant', href: '/api/assets/public/zh-Hant'},
        {locale: 'zh-Hans', href: '/api/assets/public/zh-Hans'},
        {locale: 'en', href: '/api/assets/public/en'}
      ]
    });
    expect(fetcher).toHaveBeenCalledWith('/api/bulletins?page=1&pageSize=1', expect.any(Object));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses issue-based pagination returned by the API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        issueDate: '2026-07-13',
        versions: ['zh-Hant', 'zh-Hans', 'en'].map((locale) => ({
          issueDate: '2026-07-13', locale, title: `${locale} title`,
          downloadUrl: `/assets/${locale}.pdf`, publishedAt: '2026-07-13T04:00:00Z', version: 3
        }))
      }],
      meta: {page: 1, pageSize: 12, total: 24}, error: null
    }), {status: 200}));

    const archive = await fetchWeeklyArchive({page: 1, pageSize: 12}, {fetcher, baseUrl: '/api'});

    expect(archive.items).toHaveLength(1);
    expect(archive.items[0].versions.map((version) => version.locale)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
    expect(archive.totalItems).toBe(24);
    expect(archive.totalPages).toBe(2);
    expect(fetcher).toHaveBeenCalledWith('/api/bulletins?page=1&pageSize=12', expect.any(Object));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps bulletin editions limited to Traditional Chinese, Simplified Chinese, and English', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        issueDate: '2026-07-13',
        versions: ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant'].map((locale) => ({
          issueDate: '2026-07-13', locale, title: `${locale} title`,
          downloadUrl: `/assets/${locale}.pdf`, publishedAt: '2026-07-13T04:00:00Z', version: 3
        }))
      }],
      meta: {page: 1, pageSize: 12, total: 1}, error: null
    }), {status: 200}));

    const archive = await fetchWeeklyArchive({}, {fetcher, baseUrl: '/api'});

    expect(archive.items[0].versions.map((version) => version.locale)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
  });
});
