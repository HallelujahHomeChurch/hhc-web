import {describe, expect, it, vi} from 'vitest';
import {fetchLatestWeekly, fetchWeeklyArchive} from './public-api';

describe('weekly public api', () => {
  it('selects the requested locale from the latest issue', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{issueDate: '2026-07-13', versions: [
        {
          issueDate: '2026-07-13', locale: 'zh-Hant', title: '2026-07-13 週報',
          downloadUrl: '/api/assets/public/asset-1', publishedAt: '2026-07-13T04:00:00Z', version: 3
        },
        {
          issueDate: '2026-07-13', locale: 'en', title: 'Weekly bulletin',
          downloadUrl: '/api/assets/public/asset-2', publishedAt: '2026-07-13T04:00:00Z', version: 3
        }
      ]}],
      meta: {page: 1, pageSize: 1, total: 1}, error: null
    }), {status: 200}));

    await expect(fetchLatestWeekly('en', {fetcher, baseUrl: '/api'})).resolves.toMatchObject({
      locale: 'en',
      date: '2026-07-13',
      title: 'Weekly bulletin',
      href: '/api/assets/public/asset-2'
    });
    expect(fetcher).toHaveBeenCalledWith('/api/bulletins?page=1&pageSize=1', expect.any(Object));
  });

  it('falls back to Traditional Chinese when the requested latest version is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        issueDate: '2026-07-13',
        versions: [{
          issueDate: '2026-07-13', locale: 'zh-Hant', title: '2026-07-13 週報',
          downloadUrl: '/api/assets/public/asset-1', publishedAt: '2026-07-13T04:00:00Z', version: 3
        }]
      }],
      meta: {page: 1, pageSize: 1, total: 1}, error: null
    }), {status: 200}));

    await expect(fetchLatestWeekly('en', {fetcher, baseUrl: '/api'})).resolves.toMatchObject({
      locale: 'zh-Hant',
      title: '2026-07-13 週報'
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
});
