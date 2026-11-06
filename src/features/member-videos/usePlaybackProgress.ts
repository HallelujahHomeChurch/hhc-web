'use client';

import {useCallback, useEffect, useLayoutEffect, useRef, type RefObject} from 'react';
import {usePersistentPlayback} from './PlaybackProvider';
import {createPlaybackProgress, type ProgressAPI} from './playback-progress-session';

export function usePlaybackProgress(api: ProgressAPI, id: string | undefined, version: string | undefined,
  surface: RefObject<HTMLDivElement | null>, media: RefObject<HTMLMediaElement | null>, enabled: boolean) {
  const currentApi = useRef(api);
  useLayoutEffect(() => { currentApi.current = api; }, [api]);
  const registerPlayback = usePersistentPlayback()?.registerPlayback;
  const sync = useRef<ReturnType<typeof createPlaybackProgress> | undefined>(undefined);
  useEffect(() => {
    if (!id || !version || !enabled || !surface.current) return;
    const abort = new AbortController();
    const current = createPlaybackProgress({
      progress: (...args) => currentApi.current.progress(...args),
      claimProgress: (...args) => currentApi.current.claimProgress(...args),
      saveProgress: (...args) => currentApi.current.saveProgress(...args),
    }, id, version, abort.signal);
    sync.current = current;
    const element = surface.current;
    const save = (keepalive = false) => {
      const active = media.current;
      if (!active || active.readyState < 1) return;
      const state = active.ended ? 'ended' : active.paused ? 'paused' : active.seeking || active.readyState < 2 ? 'waiting' : 'playing';
      if (keepalive) current.flush(active.currentTime, state);
      else void current.save(active.currentTime, state);
    };
    const playing = (event: Event) => {
      const active = media.current;
      if (active && event.target === active && !active.paused) void current.playing(active.currentTime);
    };
    const changed = (event: Event) => { if (event.target === media.current) save(); };
    const events = ['pause', 'seeked', 'ended'];
    const visibility = () => { if (document.visibilityState === 'hidden') save(true); };
    const pageHide = () => save(true);
    const unregisterPlayback = registerPlayback?.(pageHide, () => media.current?.currentTime ?? 0);
    element.addEventListener('playing', playing, true);
    events.forEach(event => element.addEventListener(event, changed, true));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    const timer = window.setInterval(save, 15000);
    return () => {
      unregisterPlayback?.();
      sync.current = undefined;
      abort.abort();
      window.clearInterval(timer);
      window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('playing', playing, true);
      events.forEach(event => element.removeEventListener(event, changed, true));
    };
  }, [id, version, surface, media, enabled, registerPlayback]);
  return useCallback((kind: Parameters<ReturnType<typeof createPlaybackProgress>['prepare']>[0], signal?: AbortSignal) => sync.current?.prepare(kind, signal), []);
}
