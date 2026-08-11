import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {VideoSection} from './VideoSection';

describe('VideoSection', () => {
  it('puts the YouTube mark in the localized CTA and renders responsive thumbnails', () => {
    const {container} = render(
      <VideoSection
        title="神國大樂"
        subtitle="用音樂敬拜神"
        ctaLabel="觀看更多"
        channelHref="https://youtube.com/@hhc"
        items={[{
          id: 'video-1',
          title: '敬拜影片',
          requestedLocale: 'ko',
          resolvedLocale: 'zh-Hant',
          availableLocales: ['zh-Hant'],
          imageSrc: 'https://i.ytimg.com/vi/K3ckFWeSQ-k/hqdefault.jpg',
          imageAlt: '敬拜影片縮圖',
          href: 'https://www.youtube.com/watch?v=K3ckFWeSQ-k'
        }]}
      />
    );

    const link = screen.getByRole('link', {name: '觀看更多'});
    expect(link.querySelector('svg')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Hallelujah Home Church');
    expect(screen.getByRole('img', {name: '敬拜影片縮圖'})).toHaveAttribute(
      'sizes',
      '(max-width: 900px) 100vw, 25vw'
    );
    expect(container.innerHTML).not.toContain('background-image');
    expect(screen.getByText('敬拜影片').closest('a')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByRole('heading', {name: '神國大樂'})).not.toHaveAttribute('lang', 'zh-Hant');
  });
});
