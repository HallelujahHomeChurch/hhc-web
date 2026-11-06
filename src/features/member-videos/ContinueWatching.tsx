'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {X} from 'lucide-react';
import type {RecordingResumeItem} from '@hallelujahhomechurch/hhc-web-client';
import {useBulletinAuthorization} from '@/components/layout/AccountControl';
import {createMemberVideoApi} from './api';
import {LiveCoverSurface} from './RecordingCover';
import {usePrivateCover} from '@/lib/use-private-cover';
import styles from './mini-player.module.css';
import {videoWatchPath} from './share';

export type ContinuityLabels = {resume: string; live: string; close: string; expand: string; minimize: string; move: string; resize: string};

const dismissalKey = "hhc:continue-watching-dismissal";

export function ContinueWatching({member, locale, labels, dismissed, dismiss}: {
  member: string;
  locale: string;
  labels: ContinuityLabels;
  dismissed?: string;
  dismiss: (generation: string) => void;
}) {
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [item, setItem] = useState<RecordingResumeItem | null>(null);
  const recordingId = item?.recordingId;
  const captureId = item?.captureId;
  const loadCover = useCallback((signal: AbortSignal) => captureId
    ? api.liveCover(recordingId!, captureId, signal) : api.cover(recordingId!, signal), [api, recordingId, captureId]);
  const cover = usePrivateCover({
    scope: api, resource: `continue:${item?.mediaVersion}`, enabled: Boolean(item && dismissed !== item.generation),
    load: loadCover,
  });
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    let lastRequest = -Infinity;
    const refresh = async () => {
      if (running || document.visibilityState !== 'visible' || performance.now() - lastRequest < 5000) return;
      running = true;
      lastRequest = performance.now();
      try {
        const {item} = await api.continueWatching(controller.signal);
        if (controller.signal.aborted) return;
        let hidden = false;
        try {
          const stored = JSON.parse(sessionStorage.getItem(dismissalKey) ?? 'null');
          if (stored?.member === member) hidden = stored.generation === item?.generation;
          else if (stored) sessionStorage.removeItem(dismissalKey);
        } catch { /* In-memory dismissal remains available. */ }
        setItem(hidden ? null : item);
      } catch {
        if (!controller.signal.aborted) setItem(null);
      } finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [api, member]);
  if (!item || dismissed === item.generation) return null;
  const href = videoWatchPath(locale, item.recordingId, item.publicId);
  const minutes = Math.floor(item.positionSeconds / 60);
  const position = `${minutes}:${String(Math.floor(item.positionSeconds % 60)).padStart(2, '0')}`;
  return <aside className={`${styles.resumeCard} fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-panel-border bg-panel text-ink shadow-lg`}>
    <button type="button" className="absolute right-0 top-0 z-10 grid size-11 place-items-center rounded-bl-lg bg-black/80 text-white"
      aria-label={labels.close} onClick={() => {
        dismiss(item.generation);
        try { sessionStorage.setItem(dismissalKey, JSON.stringify({member, generation: item.generation})); }
        catch { /* In-memory dismissal remains available. */ }
      }}><X size={20}/></button>
    <Link href={href} prefetch={false} className="block">
      <LiveCoverSurface url={cover} title=""/>
      <div className="p-3">
        <div className="text-sm text-muted">{item.mode === 'live' ? labels.live : `${labels.resume} · ${position}`}</div>
        <div className="font-medium">{item.title}</div>
      </div>
    </Link>
  </aside>;
}
