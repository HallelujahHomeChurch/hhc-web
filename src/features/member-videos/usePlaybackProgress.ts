'use client';

import {useCallback, useEffect, useLayoutEffect, useRef, type RefObject} from 'react';
import {usePersistentPlayback} from './PlaybackProvider';
import {createPlaybackProgress, type ProgressAPI} from './playback-progress-session';

export function usePlaybackProgress(api: ProgressAPI, id: string | undefined, version: string | undefined,
  surface: RefObject<HTMLDivElement | null>, media: RefObject<HTMLMediaElement | null>, enabled: boolean) {
  const currentApi = useRef(api);
  useLayoutEffect(() => { currentApi.current = api; }, [api]);
  const playback = usePersistentPlayback();
  const registerPlayback = playback?.registerPlayback, cardProgress = playback?.cardProgress;
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
    const element = surface.current, local = cardProgress?.bind();
    const publish = () => {
      const active = media.current;
      local?.publish(active && active.readyState >= 1 && current.ownsProgress() ? {...current.identity(),positionSeconds:active.currentTime,completed:active.ended} : null);
    };
    const save = (keepalive = false) => {
      const active = media.current;
      if (!active || active.readyState < 1) return;
      const state = active.ended ? 'ended' : active.paused ? 'paused' : active.seeking || active.readyState < 2 ? 'waiting' : 'playing';
      if (keepalive) current.flush(active.currentTime, state);
      else void Promise.resolve(current.save(active.currentTime, state)).then(publish);
      publish();
    };
    const playing = (event: Event) => {
      const active = media.current;
      if (active && event.target === active && !active.paused) void current.playing(active.currentTime).then(publish);
    };
    const changed = (event: Event) => { if (event.target === media.current) save(); };
    const events = ['pause', 'seeked', 'ended'];
    const visibility = () => { if (document.visibilityState === 'hidden') save(true); else publish(); };
    const pageHide = () => save(true);
    const unregisterPlayback = registerPlayback?.(pageHide, () => media.current?.currentTime ?? 0, current.identity);
    const timeUpdate = (event: Event) => {if (event.target === media.current) publish();};
    element.addEventListener('timeupdate', timeUpdate, true);
    element.addEventListener('playing', playing, true);
    events.forEach(event => element.addEventListener(event, changed, true));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    const timer = window.setInterval(save, 15000);
    return () => {
      unregisterPlayback?.();
      local?.dispose();
      sync.current = undefined;
      abort.abort();
      window.clearInterval(timer);
      window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('timeupdate', timeUpdate, true);
      element.removeEventListener('playing', playing, true);
      events.forEach(event => element.removeEventListener(event, changed, true));
    };
  }, [id, version, surface, media, enabled, registerPlayback, cardProgress]);
  return useCallback((kind: Parameters<ReturnType<typeof createPlaybackProgress>['prepare']>[0], signal?: AbortSignal) => sync.current?.prepare(kind, signal), []);
}
