'use client';

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {X} from 'lucide-react';
import type {RecordingResumeItem} from '@hallelujahhomechurch/hhc-web-client';
import {useBulletinAuthorization} from '@/components/layout/AccountControl';
import {createMemberVideoApi} from './api';
import {LiveCoverSurface} from './RecordingCover';
import {usePrivateCover} from '@/lib/use-private-cover';
import styles from './continue-watching.module.css';
import {playerClock} from './PlayerChrome';
import {videoWatchPath} from './share';
import {usePersistentPlayback} from './PlaybackProvider';
import {dismissResume, isResumeDismissed, isResumeEligible, resumeDismissalKey} from './resume-dismissal';

export type ContinuityLabels = {returningToLibrary?: string; retryNavigation?: string; resume: string; live: string; close: string; removeResume: string; expand: string; minimize: string; move: string; resize: string};

export function ContinueWatching({member, locale, labels, catalogueReady = false}: {
  member: string;
  locale: string;
  labels: ContinuityLabels;
  catalogueReady?: boolean;
}) {
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [item, setItem] = useState<RecordingResumeItem | null>(null);
  const [dismissedHere, setDismissedHere] = useState(false);
  const mayInsert = useRef(true);
  useLayoutEffect(() => { if (catalogueReady) mayInsert.current = false; }, [catalogueReady]);
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
    let initialResolved = false;
    const initialDeadline = window.setTimeout(() => { mayInsert.current = false; }, 1000);
    let lastRequest = -Infinity;
    const refresh = async () => {
      if (running || document.visibilityState !== 'visible' || performance.now() - lastRequest < 5000) return;
      running = true;
      lastRequest = performance.now();
      try {
        const {item} = await api.continueWatching(controller.signal);
        if (controller.signal.aborted) return;
        const candidate = item && isResumeEligible(item) && !isResumeDismissed(member, item) ? item : null;
        const initial = !initialResolved;
        initialResolved = true;
        const allowInsert = initial && mayInsert.current;
        setItem(current => {
          if (!current) return allowInsert ? candidate : null;
          if (!candidate || !isResumeEligible(current) || isResumeDismissed(member, current)) return null;
          // Refresh the visible watch session, never substitute a different link under the pointer.
          return current.recordingId === candidate.recordingId && current.mediaVersion === candidate.mediaVersion &&
            current.generation === candidate.generation ? candidate : null;
        });
      } catch {
        if (!controller.signal.aborted) { initialResolved = true; setItem(null); }
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
      clearTimeout(initialDeadline);
      window.removeEventListener('storage', storage);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [api, member]);
  if (!item || dismissedHere) return null;
  const href = videoWatchPath(locale, item.recordingId, item.publicId);
  const position = playerClock(item.positionSeconds);
  const duration = item.durationSeconds;
  const progress = item.mode === 'vod' && duration && Number.isFinite(duration) && duration > 0
    ? Math.min(100, item.positionSeconds / duration * 100) : null;
  return <aside className={styles.row} aria-label={labels.resume}>
    <Link href={href} prefetch={false} className={styles.link}>
      <div className={styles.cover}><LiveCoverSurface url={cover} title=""/></div>
      <div className={styles.content}>
        <div className={styles.title}>{item.title}</div>
        <div className={styles.action}>{item.mode === 'live' ? labels.live : `${labels.resume} · ${position}`}</div>
        {progress !== null && <progress className={styles.progress} value={progress} max={100}
          aria-label={labels.resume} aria-valuetext={`${position} / ${playerClock(duration!)}`}/>}
      </div>
    </Link>
    <button type="button" className={styles.remove} aria-label={labels.removeResume} title={labels.removeResume} onClick={() => {
      dismissResume(member, item);
      setDismissedHere(true);
    }}><X size={20}/></button>
  </aside>;
}

export function LibraryContinueWatching({member, locale, catalogueReady}: {member: string; locale: string; catalogueReady?: boolean}) {
  const playback = usePersistentPlayback();
  const [hadPlayback, setHadPlayback] = useState(Boolean(playback?.activeKey));
  if (playback?.activeKey && !hadPlayback) setHadPlayback(true);
  if (!playback || playback.activeKey || hadPlayback) return null;
  return <ContinueWatching key={member} member={member} locale={locale} labels={playback.labels} catalogueReady={catalogueReady}/>;
}
