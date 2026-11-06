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
import {usePersistentPlayback} from './PlaybackProvider';
import {dismissResume, isResumeDismissed, isResumeEligible, resumeDismissalKey} from './resume-dismissal';

export type ContinuityLabels = {resume: string; live: string; close: string; removeResume: string; expand: string; minimize: string; move: string; resize: string};

export function ContinueWatching({member, locale, labels}: {
  member: string;
  locale: string;
  labels: ContinuityLabels;
}) {
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [item, setItem] = useState<RecordingResumeItem | null>(null);
  const [dismissedHere, setDismissedHere] = useState(false);
  const recordingId = item?.recordingId;
  const captureId = item?.captureId;
  const loadCover = useCallback((signal: AbortSignal) => captureId
    ? api.liveCover(recordingId!, captureId, signal) : api.cover(recordingId!, signal), [api, recordingId, captureId]);
  const cover = usePrivateCover({
    scope: api, resource: `continue:${item?.mediaVersion}`, enabled: Boolean(item && !dismissedHere),
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
        setItem(item && isResumeEligible(item) && !isResumeDismissed(member, item) ? item : null);
      } catch {
        if (!controller.signal.aborted) setItem(null);
      } finally { running = false; }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === resumeDismissalKey) setItem(current => current && isResumeDismissed(member, current) ? null : current);
    };
    window.addEventListener('storage', storage);
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('storage', storage);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [api, member]);
  if (!item || dismissedHere) return null;
  const href = videoWatchPath(locale, item.recordingId, item.publicId);
  const minutes = Math.floor(item.positionSeconds / 60);
  const position = `${minutes}:${String(Math.floor(item.positionSeconds % 60)).padStart(2, '0')}`;
  return <aside className={`${styles.resumeCard} relative mb-6 w-64 max-w-full overflow-hidden rounded-xl border border-panel-border bg-panel text-ink shadow-lg`}>
    <button type="button" className="absolute right-0 top-0 z-10 grid size-11 place-items-center rounded-bl-lg bg-black/80 text-white"
      aria-label={labels.removeResume} title={labels.removeResume} onClick={() => {
        dismissResume(member, item);
        setDismissedHere(true);
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

export function LibraryContinueWatching({member, locale}: {member: string; locale: string}) {
  const playback = usePersistentPlayback();
  const [hadPlayback, setHadPlayback] = useState(Boolean(playback?.activeKey));
  if (playback?.activeKey && !hadPlayback) setHadPlayback(true);
  if (!playback || playback.activeKey || hadPlayback) return null;
  return <ContinueWatching key={member} member={member} locale={locale} labels={playback.labels}/>;
}
