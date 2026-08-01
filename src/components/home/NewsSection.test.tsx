import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {NewsSection} from './NewsSection';

const items = [{
  id: 'news-1',
  title: '十年養成計畫｜滿心怡姊妹分享會',
  summary: '活動摘要',
  date: '2026 / 07 / 13',
  imageAlt: '活動封面',
  href: '/zh-Hant/news/news-1'
}];

describe('NewsSection', () => {
  it('renders news item links', () => {
    const {container} = render(<NewsSection items={items} moreHref="/zh-Hant/news" moreLabel="查看更多" title="最新消息" />);

    expect(screen.getByRole('heading', {name: '最新消息'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '查看更多'})).toHaveAttribute('href', '/zh-Hant/news');
    expect(screen.getAllByRole('link').length).toBeGreaterThan(1);
    expect(screen.getByText('十年養成計畫｜滿心怡姊妹分享會')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('/assets/');
  });
});
