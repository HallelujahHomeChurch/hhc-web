import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {getHistoryTimeline} from '@/features/history/api';
import {getMessages} from '@/i18n/messages';
import {HistoryTimeline} from './HistoryTimeline';

describe('HistoryTimeline', () => {
  it('renders timeline events', () => {
    const messages = getMessages('zh-Hant');

    render(<HistoryTimeline content={messages.about.history} timeline={getHistoryTimeline('zh-Hant')} />);

    expect(screen.getByRole('heading', {name: '家教會沿革'})).toBeInTheDocument();
    expect(screen.getByText('1984年')).toBeInTheDocument();
    expect(screen.getAllByText(/家庭祭壇/).length).toBeGreaterThan(0);
  });

  it('renders localized English scripture content', () => {
    const messages = getMessages('en');

    render(<HistoryTimeline content={messages.about.history} timeline={getHistoryTimeline('en')} />);

    expect(screen.getByText(/Before I was born the Lord called me/)).toBeInTheDocument();
    expect(screen.getByText(/that my salvation may reach to the ends of the earth/)).toBeInTheDocument();
    expect(screen.getByText('Isaiah 49:1-3 NIV')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Church History'})).toBeInTheDocument();
  });
});
