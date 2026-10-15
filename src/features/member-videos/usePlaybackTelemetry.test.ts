import {expect, it} from 'vitest';
import {playbackCredit} from './usePlaybackTelemetry';
it('credits wall time once, ignoring seek distance, rate and stalled time', () => {
  expect(playbackCredit(10, 11.5, 1000, true)).toBe(1000);
  expect(playbackCredit(10, 500, 1000, false)).toBe(0);
  expect(playbackCredit(10, 10, 1000, true)).toBe(0);
  expect(playbackCredit(10, 11, 60000, true)).toBe(2000);
  expect(playbackCredit(10, 2, 1000, true)).toBe(0);
});
