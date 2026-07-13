import {describe, expect, it, vi} from 'vitest';
import {fetchLatestWeekly, fetchWeeklyArchive} from './public-api';

describe('weekly public api', () => {
  it('maps the latest published projection to a weekly bulletin', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        issueDate: '2026-07-13', locale: 'zh-Hant', title: '2026-07-13 週報',
        downloadUrl: '/api/assets/public/asset-1', publishedAt: '2026-07-13T04:00:00Z', version: 3
      },
      meta: {}, error: null
    }), {status: 200}));

    await expect(fetchLatestWeekly('zh-Hant', {fetcher, baseUrl: '/api'})).resolves.toMatchObject({
      locale: 'zh-Hant',
      date: '2026-07-13',
      title: '2026-07-13 週報',
      href: '/api/assets/public/asset-1'
    });
    expect(fetcher).toHaveBeenCalledWith('/api/bulletins/latest?locale=zh-Hant', expect.any(Object));
  });

  it('merges localized archive pages by issue date', async () => {
    const fetcher = vi.fn().mockImplementation((input: string) => {
      const locale = new URL(input, 'https://www.alive.org.tw').searchParams.get('locale')!;
      return Promise.resolve(new Response(JSON.stringify({
        data: [{
          issueDate: '2026-07-13', locale, title: `${locale} title`,
          downloadUrl: `/assets/${locale}.pdf`, publishedAt: '2026-07-13T04:00:00Z', version: 3
        }],
        meta: {page: 1, pageSize: 12, total: 1}, error: null
      }), {status: 200}));
    });

    const archive = await fetchWeeklyArchive({page: 1, pageSize: 12}, {fetcher, baseUrl: '/api'});

    expect(archive.items).toHaveLength(1);
    expect(archive.items[0].versions.map((version) => version.locale)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
    expect(archive.totalItems).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
