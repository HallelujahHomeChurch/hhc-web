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
  expect(await screen.findByRole('link', {name: /Synthetic recording.*Continue watching · 1:05/})).toHaveAttribute('href', '/video/aB_012-xyzQ');
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

it('formats a long recording with hours and keeps removal outside its watch link', async () => {
  api.continueWatching.mockResolvedValue({item: {...candidate(), positionSeconds: 4569}});
  render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  const link = await screen.findByRole('link', {name: /1:16:09/});
  expect(link).toHaveAttribute('href', '/video/aB_012-xyzQ');
  expect(link).not.toContainElement(screen.getByRole('button', {name: labels.removeResume}));
});

it('does not swap to another recording during background refresh', async () => {
  vi.useFakeTimers();
  try {
    api.continueWatching.mockResolvedValue({item: candidate()});
    render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
    await act(async () => {});
    api.continueWatching.mockResolvedValue({item: {...candidate(), recordingId: 'other', title: 'Other recording'}});
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(screen.queryByText('Other recording')).toBeNull();
    expect(screen.queryByText('Synthetic recording')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it('does not insert a late resume row after the catalogue is ready', async () => {
  let resolve!: (value: {item: ReturnType<typeof candidate>}) => void;
  api.continueWatching.mockReturnValue(new Promise(r => {resolve = r;}));
  const view = render(<ContinueWatching member="fixture" locale="en" labels={labels} catalogueReady={false}/>);
  view.rerender(<ContinueWatching member="fixture" locale="en" labels={labels} catalogueReady/>);
  await act(async () => resolve({item: candidate()}));
  expect(screen.queryByRole('link')).toBeNull();
});

it('does not insert a new candidate after an initially empty result', async () => {
  vi.useFakeTimers();
  try {
    api.continueWatching.mockResolvedValue({item: null});
    render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
    await act(async () => {});
    api.continueWatching.mockResolvedValue({item: candidate()});
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(screen.queryByRole('link')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it('bounds the initial resume lookup without resurrecting a late response', async () => {
  vi.useFakeTimers();
  try {
    let resolve!: (value: {item: ReturnType<typeof candidate>}) => void;
    api.continueWatching.mockReturnValue(new Promise(r => {resolve = r;}));
    render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(async () => resolve({item: candidate()}));
    expect(screen.queryByRole('link')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it('updates the current session progress, with a duration bar only for VOD', async () => {
  vi.useFakeTimers();
  try {
    api.continueWatching.mockResolvedValue({item: {...candidate(), durationSeconds: 130}});
    render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
    await act(async () => {});
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50');
    api.continueWatching.mockResolvedValue({item: {...candidate(), durationSeconds: 130, positionSeconds: 78}});
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '60');
  } finally { vi.useRealTimers(); }
});

it('shows return to live without presenting a duration percentage', async () => {
  api.continueWatching.mockResolvedValue({item: {...candidate(), mode: 'live', durationSeconds: 130}});
  render(<ContinueWatching member="fixture" locale="en" labels={labels}/>);
  expect(await screen.findByRole('link', {name: /Return to live/})).toBeVisible();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
