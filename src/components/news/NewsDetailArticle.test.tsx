import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {NewsDetailArticle} from './NewsDetailArticle';

const news = {
  id: 'news-1',
  title: '消息',
  summary: '',
  body: '完整內容',
  date: '2026 / 08 / 06',
  displayDate: '2026-08-06',
  authorName: '',
  firstPublishedAt: '2026-08-14T01:00:00Z',
  lastPublishedAt: '2026-08-14T02:00:00Z',
  imageAlt: '消息圖片',
  imageSrc: '/assets/news.jpg',
  href: '/ja/news/news-1',
  requestedLocale: 'ja' as const,
  resolvedLocale: 'zh-Hant' as const,
  availableLocales: ['zh-Hant' as const, 'en' as const],
  layout: 'left' as const,
};

describe('NewsDetailArticle', () => {
  it('keeps the image and all content in the selected side layout', () => {
    render(<NewsDetailArticle
      news={news}
      backHref="/ja/news"
      backLabel="戻る"
      activityDateLabel="開催日"
      authorLabel="著者"
      publishedAtLabel="公開日"
      updatedAtLabel="更新日"
      organizationName="ハレルヤ・ホームチャーチ"
    />);

    expect(screen.getByRole('article')).toHaveAttribute('data-layout', 'left');
    expect(screen.getByRole('img', {name: '消息圖片'})).not.toHaveClass('aspect-[16/9]');
    expect(screen.getByRole('img', {name: '消息圖片'})).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('完整內容').closest('[data-news-copy]')).toContainElement(screen.getByRole('heading', {name: '消息'}));
    expect(screen.getByRole('link', {name: '← 戻る'})).toHaveAttribute('href', '/ja/news');
    expect(screen.getByRole('link', {name: '← 戻る'})).not.toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByRole('heading', {name: '消息'})).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('完整內容')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('2026 / 08 / 06')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('開催日')).not.toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('ハレルヤ・ホームチャーチ')).toBeInTheDocument();
    expect(screen.getByText('公開日').nextElementSibling).toHaveAttribute('datetime', '2026-08-14T01:00:00Z');
    expect(screen.getByText('更新日').nextElementSibling).toHaveAttribute('datetime', '2026-08-14T02:00:00Z');
  });

  it('omits the updated line until the article is republished', () => {
    render(<NewsDetailArticle
      news={{...news, firstPublishedAt: '2026-08-14T01:00:00Z', lastPublishedAt: '2026-08-14T01:00:00Z'}}
      backHref="/ja/news"
      backLabel="戻る"
      activityDateLabel="開催日"
      authorLabel="著者"
      publishedAtLabel="公開日"
      updatedAtLabel="更新日"
      organizationName="ハレルヤ・ホームチャーチ"
    />);

    expect(screen.queryByText('更新日')).not.toBeInTheDocument();
  });
});
