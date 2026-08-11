import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {HistoryTimelinePayload} from '@/features/history/types';
import {getMessages} from '@/i18n/messages';
import {HistoryTimeline} from './HistoryTimeline';

const timeline: HistoryTimelinePayload = {
  events: [{
    date: '1984年',
    body: '建立家庭祭壇，並在家庭中開始聚會。',
    requestedLocale: 'zh-Hant',
    resolvedLocale: 'zh-Hant',
    availableLocales: ['zh-Hant']
  }]
};

const englishTimeline: HistoryTimelinePayload = {
  events: [{
    date: '1984',
    body: 'The first home gathering was established.',
    requestedLocale: 'en',
    resolvedLocale: 'en',
    availableLocales: ['en']
  }]
};

describe('HistoryTimeline', () => {
  it('renders timeline events', () => {
    const messages = getMessages('zh-Hant');

    render(<HistoryTimeline content={messages.about.history} timeline={timeline} scriptureLanguage="zh-Hant" />);

    expect(screen.getByRole('heading', {name: '家教會沿革'})).toBeInTheDocument();
    expect(screen.getByText('1984年')).toBeInTheDocument();
    expect(screen.getAllByText(/家庭祭壇/).length).toBeGreaterThan(0);
  });

  it('renders localized English scripture content', () => {
    const messages = getMessages('en');

    render(<HistoryTimeline content={messages.about.history} timeline={englishTimeline} scriptureLanguage="en" />);

    expect(screen.getByText(/Before I was born the Lord called me/)).toBeInTheDocument();
    expect(screen.getByText(/that my salvation may reach to the ends of the earth/)).toBeInTheDocument();
    expect(screen.getByText('Isaiah 49:1-3 NIV')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Church History'})).toBeInTheDocument();
    expect(screen.getAllByRole('blockquote')).toSatisfy((quotes: HTMLElement[]) => quotes.every((quote) => quote.lang === 'en'));
  });

  it('keeps Japanese chrome while marking scripture and fallback history independently', () => {
    const messages = getMessages('ja');
    const fallbackTimeline: HistoryTimelinePayload = {events: [{
      date: '1984年3月1日',
      body: '領受建造家庭祭壇的異象。',
      requestedLocale: 'ja',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en']
    }]};

    render(<HistoryTimeline content={messages.about.history} timeline={fallbackTimeline} scriptureLanguage="en" />);

    expect(screen.getAllByRole('blockquote')).toSatisfy((quotes: HTMLElement[]) => quotes.every((quote) => quote.lang === 'en'));
    expect(screen.getByRole('heading', {name: '教会の歩み'})).not.toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('領受建造家庭祭壇的異象。').closest('li')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('1984年3月1日')).toHaveAttribute('lang', 'zh-Hant');
  });
});
