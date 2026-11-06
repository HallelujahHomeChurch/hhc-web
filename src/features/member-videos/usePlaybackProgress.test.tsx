import {act, render} from '@testing-library/react';
import {useEffect, useRef} from 'react';
import {expect, it, vi} from 'vitest';
import {usePlaybackProgress} from './usePlaybackProgress';

const version = 'vod:package';

it('lets B claim only after playing and stops stale A writes while A keeps playing', async () => {
  let generation: string | null = null;
  let sequence = 0;
  let positionSeconds = 0;
  let claimCount = 0;
  const api = {
    progress: vi.fn(async () => ({
      mediaVersion: version,
      claimToken: 'token',
      progress: generation ? {generation, mediaVersion: version, completed: false, mode: 'vod' as const, positionSeconds, updatedAt: '2026-11-06T00:00:00Z'} : null,
    })),
    claimProgress: vi.fn(async (_id, input) => {
      expect(input.expectedGeneration).toBe(generation);
      generation = `generation-${++claimCount}`;
      positionSeconds = input.observedPositionSeconds;
      sequence = 0;
      return {generation, mediaVersion: version, positionSeconds, sequence};
    }),
    saveProgress: vi.fn(async (_id, input) => {
      if (input.generation !== generation) throw {status: 409, code: 'progress_superseded'};
      sequence = input.sequence;
      positionSeconds = input.positionSeconds;
      return {accepted: true, sequence};
    }),
  };
  const prepared = vi.fn();
  function Device({name}: {name: string}) {
    const surface = useRef<HTMLDivElement>(null);
    const media = useRef<HTMLVideoElement>(null);
    const prepare = usePlaybackProgress(api, 'recording', version, surface, media, true);
    useEffect(() => { void prepare('resume')?.then(value => prepared(name, value)); }, [name, prepare]);
    return <div ref={surface}><video aria-label={name} ref={media}/></div>;
  }
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const a = render(<Device name="A"/>);
  const first = a.getByLabelText('A') as HTMLVideoElement;
  const emit = async (element: HTMLVideoElement, event: string, position: number) => {
    Object.defineProperties(element, {paused: {value: false, configurable: true}, readyState: {value: 4, configurable: true}});
    element.currentTime = position;
    await act(async () => { element.dispatchEvent(new Event(event)); });
  };
  await act(async () => {});
  expect(api.claimProgress).not.toHaveBeenCalled();
  await emit(first, 'playing', 40);
  await emit(first, 'seeked', 65);
  const b = render(<Device name="B"/>);
  await act(async () => {});
  expect(prepared).toHaveBeenLastCalledWith('B', 65);
  expect(api.claimProgress).toHaveBeenCalledTimes(1);
  await emit(b.getByLabelText('B') as HTMLVideoElement, 'playing', 65);
  expect(api.claimProgress).toHaveBeenCalledTimes(2);
  await emit(first, 'seeked', 90);
  const writes = api.saveProgress.mock.calls.length;
  await emit(first, 'ended', 100);
  await emit(first, 'playing', 101);
  await emit(first, 'seeked', 102);
  expect(api.saveProgress).toHaveBeenCalledTimes(writes);
  expect(api.claimProgress).toHaveBeenCalledTimes(2);
  expect(positionSeconds).toBe(65);
  expect(first.paused).toBe(false);
  expect(pause).not.toHaveBeenCalled();
  pause.mockRestore();
});
