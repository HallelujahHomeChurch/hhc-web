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

it('honors Retry-After, replaces the pending write and skips unchanged positions', async () => {
  const {createPlaybackProgress} = await import('./playback-progress-session');
  vi.useFakeTimers();
  const controller = new AbortController();
  try {
    const api = {
      progress: vi.fn().mockResolvedValue({mediaVersion: version, claimToken: 'token', progress: null}),
      claimProgress: vi.fn().mockResolvedValue({generation: 'owner', mediaVersion: version, positionSeconds: 0, sequence: 0}),
      saveProgress: vi.fn().mockRejectedValueOnce({status: 429, retryAfter: '2'}).mockResolvedValue({accepted: true, sequence: 2}),
    };
    const sync = createPlaybackProgress(api, 'recording', version, controller.signal);
    await sync.prepare('resume');
    await sync.playing(0);
    await sync.save(4, 'playing');
    await sync.save(8, 'playing');
    await vi.advanceTimersByTimeAsync(1999);
    expect(api.saveProgress).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.saveProgress.mock.calls.map(([, update]) => update.positionSeconds)).toEqual([4, 8]);
    await sync.save(8, 'playing');
    expect(api.saveProgress).toHaveBeenCalledTimes(2);
  } finally {
    controller.abort();
    vi.useRealTimers();
  }
});

it('sends a final keepalive with a higher sequence while an earlier write is in flight', async () => {
  const {createPlaybackProgress} = await import('./playback-progress-session');
  const controller = new AbortController();
  const api = {
    progress: vi.fn().mockResolvedValue({mediaVersion: version, claimToken: 'token', progress: null}),
    claimProgress: vi.fn().mockResolvedValue({generation: 'owner', mediaVersion: version, positionSeconds: 0, sequence: 0}),
    saveProgress: vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue({accepted: true, sequence: 2}),
  };
  const sync = createPlaybackProgress(api, 'recording', version, controller.signal);
  await sync.prepare('resume');
  await sync.playing(0);
  void sync.save(4, 'playing');
  sync.flush(8, 'paused');
  controller.abort();
  expect(api.saveProgress).toHaveBeenLastCalledWith('recording',
    expect.objectContaining({sequence: 2, positionSeconds: 8, generation: 'owner'}),
    {keepalive: true});
});

it('returns control to playback when a progress lookup never settles', async () => {
  const {createPlaybackProgress} = await import('./playback-progress-session');
  vi.useFakeTimers();
  const controller = new AbortController();
  try {
    const api = {progress: vi.fn(() => new Promise<never>(() => {})), claimProgress: vi.fn(), saveProgress: vi.fn()};
    const sync = createPlaybackProgress(api, 'recording', version, controller.signal);
    const prepared = sync.prepare('resume');
    await vi.advanceTimersByTimeAsync(1500);
    await expect(prepared).resolves.toBeUndefined();
    await sync.playing(10);
    expect(api.claimProgress).not.toHaveBeenCalled();
  } finally {
    controller.abort();
    vi.useRealTimers();
  }
});


it('retains the progress owner and sequence while using the latest route client', async () => {
  const api = {
    progress: vi.fn().mockResolvedValue({mediaVersion: version, claimToken: 'token', progress: null}),
    claimProgress: vi.fn().mockResolvedValue({generation: 'owner', mediaVersion: version, positionSeconds: 0, sequence: 0}),
    saveProgress: vi.fn().mockResolvedValue({accepted: true, sequence: 1}),
  };
  const next = {...api, saveProgress: vi.fn().mockResolvedValue({accepted: true, sequence: 2})};
  function Player({client}: {client: typeof api}) {
    const surface = useRef<HTMLDivElement>(null);
    const media = useRef<HTMLVideoElement>(null);
    const prepare = usePlaybackProgress(client, 'recording', version, surface, media, true);
    useEffect(() => { void prepare('resume'); }, [prepare]);
    return <div ref={surface}><video ref={media}/></div>;
  }
  const view = render(<Player client={api}/>);
  const video = view.container.querySelector('video')!;
  Object.defineProperties(video, {paused: {value: false}, readyState: {value: 4}});
  await act(async () => {});
  await act(async () => { video.dispatchEvent(new Event('playing')); });
  video.currentTime = 4;
  await act(async () => { video.dispatchEvent(new Event('seeked')); });
  const original = api.saveProgress.mock.calls[0][1];
  view.rerender(<Player client={next}/>);
  video.currentTime = 8;
  await act(async () => { video.dispatchEvent(new Event('seeked')); });
  expect(next.saveProgress).toHaveBeenCalledWith('recording', expect.objectContaining({
    sessionId: original.sessionId, generation: 'owner', sequence: 2, positionSeconds: 8,
  }), expect.anything());
  expect(api.claimProgress).toHaveBeenCalledTimes(1);
  expect(api.progress).toHaveBeenCalledTimes(1);
});
