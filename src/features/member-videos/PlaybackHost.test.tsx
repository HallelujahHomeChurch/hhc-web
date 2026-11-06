import {render, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {PlaybackHost} from './PlaybackHost';

it('keeps the same media nodes when the watch slot disappears and returns', () => {
  const slot = document.createElement('div');
  const renderHost = (watchSlot: HTMLElement | null) => (
    <PlaybackHost watchSlot={watchSlot}>
      <video data-testid="video"/>
      <audio data-testid="audio"/>
    </PlaybackHost>
  );
  const view = render(renderHost(slot));
  const video = screen.getByTestId('video');
  const audio = screen.getByTestId('audio');
  const parent = video.parentElement;
  view.rerender(renderHost(null));
  expect(screen.getByTestId('video')).toBe(video);
  expect(screen.getByTestId('audio')).toBe(audio);
  expect(video.parentElement).toBe(parent);
  expect(parent).toHaveAttribute('data-presentation', 'mini');
  view.rerender(renderHost(slot));
  expect(screen.getByTestId('video')).toBe(video);
  expect(screen.getByTestId('audio')).toBe(audio);
  expect(parent).toHaveAttribute('data-presentation', 'watch');
});
