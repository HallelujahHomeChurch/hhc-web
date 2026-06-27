import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {getNews} from '@/features/news/api';
import {NewsSection} from './NewsSection';

describe('NewsSection', () => {
  it('renders news item links', () => {
    const {container} = render(<NewsSection items={getNews('zh-Hant')} moreLabel="查看更多" title="最新消息" />);

    expect(screen.getByRole('heading', {name: '最新消息'})).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeGreaterThan(1);
    expect(screen.getByText('十年養成計畫｜滿心怡姊妹分享會')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('/assets/');
  });
});
