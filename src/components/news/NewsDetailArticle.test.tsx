import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {NewsDetailArticle} from './NewsDetailArticle';

const news = {
  id: 'news-1',
  title: '消息',
  summary: '',
  body: '完整內容',
  date: '2026 / 08 / 06',
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
    render(<NewsDetailArticle news={news} backHref="/ja/news" backLabel="戻る" publishedAtLabel="公開日" />);

    expect(screen.getByRole('article')).toHaveAttribute('data-layout', 'left');
    expect(screen.getByRole('img', {name: '消息圖片'})).not.toHaveClass('aspect-[16/9]');
    expect(screen.getByRole('img', {name: '消息圖片'})).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('完整內容').closest('[data-news-copy]')).toContainElement(screen.getByRole('heading', {name: '消息'}));
    expect(screen.getByRole('link', {name: '← 戻る'})).toHaveAttribute('href', '/ja/news');
    expect(screen.getByRole('link', {name: '← 戻る'})).not.toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByRole('heading', {name: '消息'})).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('完整內容')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('2026 / 08 / 06')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('公開日')).not.toHaveAttribute('lang', 'zh-Hant');
  });
});
