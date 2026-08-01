import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {VideoSection} from './VideoSection';

describe('VideoSection', () => {
  it('puts the YouTube mark in the localized CTA without a separate branding row', () => {
    const {container} = render(
      <VideoSection
        title="神國大樂"
        subtitle="用音樂敬拜神"
        ctaLabel="觀看更多"
        channelHref="https://youtube.com/@hhc"
        items={[]}
      />
    );

    const link = screen.getByRole('link', {name: '觀看更多'});
    expect(link.querySelector('svg')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Hallelujah Home Church');
  });
});
