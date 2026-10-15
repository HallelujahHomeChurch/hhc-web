'use client';
import {useEffect, type RefObject} from 'react';
import type {createMemberVideoApi} from './api';
import type {RecordingHeartbeatInput} from '@hallelujahhomechurch/hhc-web-client';

// Count progressing playback wall time, not seek distance or playback speed.
export function playbackCredit(previous: number, current: number, elapsed: number, playing: boolean) {
  return playing && current > previous ? Math.max(0, Math.min(2000, elapsed)) : 0;
}
export function usePlaybackTelemetry(api: ReturnType<typeof createMemberVideoApi>, id: string | undefined, video: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!id || !enabled || !api.heartbeat) return;
    const abort = new AbortController(), session = crypto.randomUUID();
    let sequence = 0, delta = 0, previous = 0, last = performance.now(), ticks = 0, wasPlaying = false, sending = false, disabled = false;
    const send = async (media: HTMLVideoElement) => {
      if (sending || disabled || abort.signal.aborted) return;
      const state: RecordingHeartbeatInput['state'] = media.ended ? 'ended' : media.paused ? 'paused' : media.readyState < 2 || media.seeking ? 'waiting' : 'playing';
      const credit = delta; delta = 0; sending = true;
      try {
        await api.heartbeat(id, {playbackSessionId: session, sequence: ++sequence, state, position: Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : 0, deltaPlayingMs: Math.round(Math.min(30000, credit))}, abort.signal);
      } catch (error) {
        // Telemetry never interrupts playback. Authorization/disabled responses stop this mount.
        const status = (error as {status?: number}).status;
        if ([401, 403, 404].includes(status ?? 0) || (error as {code?: string}).code === 'recording_analytics_unavailable') disabled = true;
      } finally { sending = false; }
    };
    const timer = window.setInterval(() => {
      const now = performance.now(), media = video.current;
      if (media) {
        delta += playbackCredit(previous, media.currentTime, now - last, wasPlaying && !media.seeking && media.readyState >= 2);
        wasPlaying = !media.paused && !media.ended && !media.seeking && media.readyState >= 2;
        previous = media.currentTime;
        if (++ticks % 15 === 1 || media.ended && delta > 0) void send(media);
      }
      last = now;
    }, 1000);
    return () => { window.clearInterval(timer); abort.abort(); };
  }, [api, id, video, enabled]);
}
