import {act, fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {ContinueWatching} from './ContinueWatching';
import {clearResumeDismissals, dismissResume} from './resume-dismissal';

const api = vi.hoisted(() => ({
  continueWatching: vi.fn(),
  cover: vi.fn().mockRejectedValue(new Error('Fixture has no cover')),
  liveCover: vi.fn().mockRejectedValue(new Error('Fixture has no cover')),
}));
vi.mock('./api', () => ({createMemberVideoApi: () => api}));
const labels = {removeResume: 'Remove from continue watching', resume: 'Continue watching', live: 'Return to live', close: 'Close player', expand: '', minimize: '', move: '', resize: ''};
const candidate = () => ({title: 'Synthetic recording', recordingId: 'recording', publicId: 'aB_012-xyzQ',
  mode: 'vod', mediaVersion: 'vod:package', positionSeconds: 65, generation: 'A', sessionId: 'session-A',
  claimedAt: new Date(Date.now() - 10000).toISOString(), updatedAt: new Date().toISOString()});
beforeEach(() => { clearResumeDismissals(); api.continueWatching.mockReset(); });

it('shows inline saved progress without media and keeps removal across reload', async () => {
  const item = candidate(); api.continueWatching.mockResolvedValue({item});
  const view = render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  expect(await screen.findByRole('link', {name: /Continue watching · 1:05.*Synthetic recording/})).toHaveAttribute('href', '/video/aB_012-xyzQ');
  expect(view.container.querySelector('video,audio')).toBeNull();
  expect(view.container.querySelector('aside')).not.toHaveClass('fixed');
  fireEvent.click(screen.getByRole('button', {name: labels.removeResume}));
  expect(screen.queryByRole('link')).toBeNull();
  view.unmount();
  render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  await act(async () => {});
  expect(screen.queryByRole('link')).toBeNull();
});

it('does not replace a removed card during the same visit but allows a new owner on the next visit', async () => {
  vi.useFakeTimers();
  try {
    api.continueWatching.mockResolvedValue({item: candidate()});
    const view = render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', {name: labels.removeResume}));
    api.continueWatching.mockResolvedValue({item: {...candidate(), generation: 'B', sessionId: 'session-B'}});
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(screen.queryByRole('link')).toBeNull();
    view.unmount();
    render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
    await act(async () => {});
    expect(screen.getByRole('link')).toBeVisible();
  } finally { vi.useRealTimers(); }
});

it('suppresses a late claim from the closed session while allowing another device', async () => {
  const item = candidate();
  dismissResume('fixture', {...item, generation: undefined});
  api.continueWatching.mockResolvedValue({item});
  const view = render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  await act(async () => {});
  expect(screen.queryByRole('link')).toBeNull();
  view.unmount();
  api.continueWatching.mockResolvedValue({item: {...item, generation: 'B', sessionId: 'session-B'}});
  render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  expect(await screen.findByRole('link')).toBeVisible();
});

it.each(['zero', 'claim-only', 'expired'])('does not suggest %s progress', async kind => {
  const item = candidate();
  if (kind === 'zero') item.positionSeconds = 0;
  if (kind === 'claim-only') item.updatedAt = item.claimedAt;
  if (kind === 'expired') {item.claimedAt = '2020-01-01T00:00:00Z'; item.updatedAt = '2020-01-02T00:00:00Z';}
  api.continueWatching.mockResolvedValue({item});
  render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  await act(async () => {});
  expect(screen.queryByRole('link')).toBeNull();
});
