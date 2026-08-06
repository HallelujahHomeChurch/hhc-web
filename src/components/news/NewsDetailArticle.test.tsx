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
  href: '/zh-Hant/news/news-1',
  layout: 'left' as const,
};

describe('NewsDetailArticle', () => {
  it('keeps the image and all content in the selected side layout', () => {
    render(<NewsDetailArticle news={news} backHref="/zh-Hant/news" backLabel="返回" publishedAtLabel="發布日期" />);

    expect(screen.getByRole('article')).toHaveAttribute('data-layout', 'left');
    expect(screen.getByRole('img', {name: '消息圖片'})).not.toHaveClass('aspect-[16/9]');
    expect(screen.getByText('完整內容').closest('[data-news-copy]')).toContainElement(screen.getByRole('heading', {name: '消息'}));
  });
});
