import {describe, expect, it, vi} from 'vitest';

const {getNewsBySlug} = vi.hoisted(() => ({getNewsBySlug: vi.fn()}));

vi.mock('@/features/news/api', () => ({getNewsBySlug}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));

import {generateMetadata} from './page';

describe('news detail metadata', () => {
  it('uses the resolved locale and only exact available translations', async () => {
    getNewsBySlug.mockResolvedValue({
      id: 'news-1',
      title: '消息',
      summary: '摘要',
      body: '內容',
      date: '2026 / 08 / 11',
      imageAlt: '封面',
      href: '/zh-Hant/news/announcement',
      layout: 'top',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en']
    });

    const metadata = await generateMetadata({params: Promise.resolve({locale: 'ja', slug: 'announcement'})});

    expect(metadata.alternates).toEqual({
      canonical: '/zh-Hant/news/announcement',
      languages: {
        'zh-Hant': 'https://www.alive.org.tw/zh-Hant/news/announcement',
        en: 'https://www.alive.org.tw/en/news/announcement'
      }
    });
    expect(metadata.openGraph).toMatchObject({
      locale: 'zh_TW',
      url: 'https://www.alive.org.tw/zh-Hant/news/announcement'
    });
  });
});
