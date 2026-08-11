import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {NewsSection} from './NewsSection';

const items = Array.from({length: 4}, (_, index) => ({
  id: `news-${index + 1}`,
  title: index === 0 ? '十年養成計畫｜滿心怡姊妹分享會' : `消息 ${index + 1}`,
  summary: '活動摘要',
  date: '2026 / 07 / 13',
  imageAlt: '活動封面',
  imageSrc: index === 0 ? 'https://www.alive.org.tw/assets/public/news-cover' : undefined,
  requestedLocale: 'zh-Hant' as const,
  resolvedLocale: 'zh-Hant' as const,
  availableLocales: ['zh-Hant' as const],
  href: `/zh-Hant/news/news-${index + 1}`
}));

describe('NewsSection', () => {
  it('renders news item links', () => {
    const {container} = render(<NewsSection items={items} moreHref="/zh-Hant/news" moreLabel="查看更多" title="最新消息" />);

    expect(screen.getByRole('heading', {name: '最新消息'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '查看更多'})).toHaveAttribute('href', '/zh-Hant/news');
    expect(screen.getAllByRole('link').length).toBeGreaterThan(1);
    expect(screen.getByText('十年養成計畫｜滿心怡姊妹分享會')).toBeInTheDocument();
    expect(screen.getAllByText('2026 / 07 / 13')).toHaveLength(3);
    expect(screen.queryByText('消息 4')).not.toBeInTheDocument();
    expect(screen.queryByText('活動摘要')).not.toBeInTheDocument();
    const image = screen.getByRole('img', {name: '活動封面'});
    expect(image).toHaveAttribute('sizes', '(max-width: 620px) 112px, 132px');
    expect(container.innerHTML).not.toContain('background-image');
  });

  it('keeps Japanese chrome and href while marking fallback card content as Traditional Chinese', () => {
    render(<NewsSection items={[{...items[0], requestedLocale: 'ja', href: '/ja/news/news-1'}]} moreHref="/ja/news" moreLabel="もっと見る" title="最新のお知らせ" />);

    expect(screen.getByRole('heading', {name: '最新のお知らせ'})).not.toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByRole('link', {name: /十年養成計畫/})).toHaveAttribute('href', '/ja/news/news-1');
    expect(screen.getByText('十年養成計畫｜滿心怡姊妹分享會').closest('li')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('2026 / 07 / 13')).toHaveAttribute('lang', 'zh-Hant');
  });
});
