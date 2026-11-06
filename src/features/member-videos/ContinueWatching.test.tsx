import {act, fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {ContinueWatching} from './ContinueWatching';

const api = vi.hoisted(() => ({
  continueWatching: vi.fn(),
  cover: vi.fn().mockRejectedValue(new Error('Fixture has no cover')),
  liveCover: vi.fn().mockRejectedValue(new Error('Fixture has no cover')),
}));
vi.mock('./api', () => ({createMemberVideoApi: () => api}));

const labels = {resume: 'Continue watching', live: 'Return to live', close: 'Close player', expand: '', minimize: '', move: '', resize: ''};

it('shows the saved position without mounting media and dismisses only that generation', async () => {
  api.continueWatching.mockResolvedValue({item: {
    title: 'Synthetic recording', recordingId: 'recording', publicId: 'aB_012-xyzQ',
    mode: 'vod', mediaVersion: 'vod:package', positionSeconds: 65, generation: 'A',
  }});
  const dismiss = vi.fn();
  const view = render(<ContinueWatching member="fixture" locale="en" labels={labels} dismiss={dismiss}/>);
  expect(await screen.findByRole('link', {name: /Continue watching · 1:05.*Synthetic recording/})).toHaveAttribute('href', '/video/aB_012-xyzQ');
  expect(view.container.querySelector('video,audio')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Close player'}));
  expect(dismiss).toHaveBeenCalledWith('A');
  view.rerender(<ContinueWatching member="fixture" locale="en" labels={labels} dismissed="A" dismiss={dismiss}/>);
  expect(screen.queryByRole('link')).toBeNull();
  view.rerender(<ContinueWatching member="fixture" locale="en" labels={labels} dismissed="older" dismiss={dismiss}/>);
  await act(async () => {});
  expect(screen.getByRole('link')).toBeVisible();
  view.unmount();
  render(<ContinueWatching member="fixture" locale="en" labels={labels} dismiss={dismiss}/>);
  await act(async () => {});
  expect(screen.queryByRole('link')).toBeNull();
});

it('renders resume in the library flow rather than a viewport overlay', async () => {
  api.continueWatching.mockResolvedValue({item: {
    title: 'Inline recording', recordingId: 'inline-recording', publicId: 'aB_012-xyzQ',
    mode: 'vod', mediaVersion: 'vod:package', positionSeconds: 65, generation: 'inline',
  }});
  const view = render(<ContinueWatching member="inline" locale="en" labels={labels} dismiss={vi.fn()}/>);
  await screen.findByRole('link', {name: /Inline recording/});
  expect(view.container.querySelector('aside')).not.toHaveClass('fixed');
});
