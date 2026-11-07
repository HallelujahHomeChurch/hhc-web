'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import styles from './mini-player.module.css';
import {X} from 'lucide-react';
import {useAccountIdentity, useAccountAuth, useVideoAccess} from '@/components/layout/AccountControl';
import {useMediaDocument} from '@/components/layout/MediaDocument';
import type {ContinuityLabels} from './ContinueWatching';
import {PlaybackHost} from './PlaybackHost';
import {RetainedLibrary, type LibrarySurface} from './RetainedLibrary';
import {bindResumeDismissalAccount, clearResumeDismissals, dismissResume, type ResumeIdentity} from './resume-dismissal';

type Playback = {key: string; href: string; title: string; player: ReactNode};
type Slot = {key: string; element: HTMLElement};
type PlaybackControl = {
  activeKey: string | undefined;
  activeHref: string | undefined;
  labels: ContinuityLabels;
  inWatch: boolean;
  expand: () => void;
  minimize: (navigate: () => void) => void;
  setMinimizeOffset: (offset: number) => void;
  start: (playback: Playback, explicit?: boolean) => void;
  setSlot: (key: string, element: HTMLElement | null) => void;
  close: (key: string) => void;
  rememberLibrary: (href: string, scroll: number) => void;
  retainLibrary: (surface: LibrarySurface, element: HTMLElement | null) => void;
  prepareLibrary: (surface: LibrarySurface) => void;
  returnToLibrary: (fallback: string) => {href: string; scroll: number};
  takeLibraryScroll: () => number | undefined;
  registerPlayback: (flush: () => void, time: () => number, identity: () => ResumeIdentity) => () => void;
  currentTime: () => number;
};

const Context = createContext<PlaybackControl | null>(null);
export const usePersistentPlayback = () => useContext(Context);

type Props = {children: ReactNode; locale: string; labels: ContinuityLabels};

export function PlaybackProvider({children, locale, labels}: Props) {
  const identity = useAccountIdentity();
  const access = useVideoAccess();
  const auth = useAccountAuth();
  useEffect(() => {
    if (auth.status === 'anonymous') clearResumeDismissals();
    else if (identity) bindResumeDismissalAccount(identity);
  }, [identity, auth.status]);
  const {privateMediaReady} = useMediaDocument();
  const member = access === 'available' && privateMediaReady ? identity : null;
  return <MemberPlaybackProvider member={member} locale={locale} labels={labels}>{children}</MemberPlaybackProvider>;
}

function MemberPlaybackProvider({children, labels, member}: Props & {member: string | null}) {
  const router = useRouter();
  const [minimizeOffset, setMinimizeOffset] = useState(0);
  const [minimizing, setMinimizing] = useState<{id: number; settled: boolean} | null>(null);
  const [slowTransition, setSlowTransition] = useState(0);
  const navigateToLibrary = useRef<(() => void) | null>(null);
  const transitionId = useRef(0);
  const pendingTransition = useRef(false);
  const minimize = useCallback((navigate: () => void) => {
    if (pendingTransition.current) return;
    pendingTransition.current = true;
    const id = ++transitionId.current;
    setMinimizing({id, settled: false});
    navigateToLibrary.current = navigate;
    try { navigate(); } catch { setSlowTransition(id); }
  }, []);
  const cancelTransition = useCallback(() => {
    pendingTransition.current = false;
    navigateToLibrary.current = null;
    setMinimizing(null);
    setMinimizeOffset(0);
  }, []);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [slot, setWatchSlot] = useState<Slot | null>(null);
  const [closed, setClosed] = useState<string>();
  const lastWatchSlot = useRef<(Slot & {member: string | null}) | null>(null);
  const closedWatchSlots = useRef(new WeakMap<HTMLElement, string>());
  useEffect(() => {
    if (lastWatchSlot.current?.member !== member) lastWatchSlot.current = null;
  }, [member]);
  const [librarySurface, setLibrarySurface] = useState<LibrarySurface | null>(null);
  const [libraryScroll, setLibraryScroll] = useState(0);
  const [librarySlot, setLibrarySlot] = useState<Slot | null>(null);
  useEffect(() => {
    if (!minimizing || librarySlot) return;
    const timer = window.setTimeout(() => setSlowTransition(minimizing.id), 2000);
    return () => window.clearTimeout(timer);
  }, [minimizing, librarySlot]);
  const [owner, setOwner] = useState(member);
  if (member !== owner) {
    setOwner(member);
    setPlayback(null);
    setWatchSlot(null);
    setClosed(undefined);
    setLibrarySurface(null);
    setLibrarySlot(null);
    setLibraryScroll(0);
    setMinimizing(null);
    setMinimizeOffset(0);
  }
  const library = useRef<{member: string | null; href: string; scroll: number} | undefined>(undefined);
  const restoreScroll = useRef<number | undefined>(undefined);
  const retainLibrary = useCallback((surface: LibrarySurface, element: HTMLElement | null) => {
    if (element) setLibrarySurface(surface);
    setLibrarySlot(current => element ? {key: surface.key, element} : current?.key === surface.key ? null : current);
  }, []);
  const prepareLibrary = useCallback((surface: LibrarySurface) => { setLibrarySurface(current => current ?? surface); }, []);
  const rememberLibrary = useCallback((href: string, scroll: number) => { library.current = {member, href, scroll}; setLibraryScroll(scroll); }, [member]);
  const returnToLibrary = useCallback((fallback: string) => {
    const target = library.current?.member === member ? library.current : {href: fallback, scroll: 0};
    restoreScroll.current = target.scroll;
    return target;
  }, [member]);
  const takeLibraryScroll = useCallback(() => {
    const value = restoreScroll.current;
    restoreScroll.current = undefined;
    return value;
  }, []);
  const playbackAccess = useRef<{flush: () => void; time: () => number; identity: () => ResumeIdentity} | null>(null);
  const previousPlaybackKey = playback?.key;
  const start = useCallback((next: Playback, explicit = false) => {
    if (!explicit && closed === next.key) return;
    if (previousPlaybackKey && previousPlaybackKey !== next.key) playbackAccess.current?.flush();
    if (previousPlaybackKey !== next.key) cancelTransition();
    setPlayback(next);
    if (explicit || next.key !== closed) setClosed(undefined);
  }, [closed, previousPlaybackKey, cancelTransition]);
  const setSlot = useCallback((key: string, element: HTMLElement | null) => {
    if (element && closedWatchSlots.current.get(element) === key) return;
    if (element) lastWatchSlot.current = {key, element, member};
    setWatchSlot(current => element ? {key, element} : current?.key === key ? null : current);
    if (!element) setMinimizeOffset(0);
    if (element) setClosed(current => current === key ? undefined : current);
  }, [member]);
  const close = useCallback((key: string) => {
    cancelTransition();
    if (previousPlaybackKey === key) playbackAccess.current?.flush();
    if (lastWatchSlot.current?.key === key && lastWatchSlot.current.member === member) closedWatchSlots.current.set(lastWatchSlot.current.element, key);
    setClosed(key);
    setPlayback(current => current?.key === key ? null : current);
  }, [previousPlaybackKey, cancelTransition, member]);
  const registerPlayback = useCallback((flush: () => void, time: () => number, identity: () => ResumeIdentity) => {
    const value = {flush, time, identity};
    playbackAccess.current = value;
    return () => { if (playbackAccess.current === value) playbackAccess.current = null; };
  }, []);
  const currentTime = useCallback(() => playbackAccess.current?.time() ?? 0, []);
  const activeKey = playback?.key;
  const activeHref = playback?.href;
  const closeActive = useCallback(() => {
    if (!activeKey) return;
    const identity = playbackAccess.current?.identity();
    if (member && identity) dismissResume(member, identity);
    close(activeKey);
  }, [activeKey, close, member]);
  const settlingId = minimizing?.id;
  const settled = useCallback(() => {
    setMinimizing(current => current && current.id === settlingId ? {...current, settled: true} : current);
  }, [settlingId]);
  useEffect(() => { if (!minimizing) { pendingTransition.current = false; navigateToLibrary.current = null; } }, [minimizing]);
  if (minimizing?.settled && librarySlot && !slot) {
    setMinimizing(null);
    setMinimizeOffset(0);
  }
  const watchSlot = !minimizing && playback && slot?.key === playback.key ? slot.element : null;
  const inWatch = Boolean(watchSlot);
  const expand = useCallback(() => { if (activeHref) { cancelTransition(); router.push(activeHref); } }, [activeHref, router, cancelTransition]);
  const controls = useMemo(() => ({activeKey, activeHref, start, setSlot, close, labels, inWatch, expand, minimize, setMinimizeOffset, registerPlayback, currentTime, rememberLibrary, returnToLibrary, takeLibraryScroll, retainLibrary, prepareLibrary}), [activeKey, activeHref, start, setSlot, close, labels, inWatch, expand, minimize, setMinimizeOffset, registerPlayback, currentTime, rememberLibrary, returnToLibrary, takeLibraryScroll, retainLibrary, prepareLibrary]);

  return <Context.Provider value={member ? controls : null}>
    {children}
    {member && <RetainedLibrary surface={librarySurface} slot={librarySlot?.element ?? null} visible={minimizeOffset > 0 || Boolean(minimizing)}
      scroll={libraryScroll}/>}
    {member && playback && minimizing && !librarySlot && slowTransition === minimizing.id && <div className={styles.routeNotice}>
      <p role="status">{labels.returningToLibrary ?? 'Returning to videos…'}</p>
      <button type="button" className="min-h-11 cursor-pointer underline" onClick={() => {
        try { navigateToLibrary.current?.(); } catch { /* Keep the same explicit retry; never navigate backwards on a timer. */ }
      }}>{labels.retryNavigation ?? 'Try again'}</button>
    </div>}
    {member && playback && <PlaybackHost watchSlot={watchSlot} minimizeOffset={minimizeOffset} onSettled={settled} onClose={closeActive} moveLabel={labels.move} resizeLabel={labels.resize}>
      <div key={playback.key}>{playback.player}</div>
      {!watchSlot && <div className={styles.close}>
        <button type="button" aria-label={labels.close} className="grid size-11 place-items-center" onClick={closeActive}><X size={20}/></button>
      </div>}
      {!watchSlot && <Link href={playback.href} onNavigate={cancelTransition} className={styles.caption}><span className={styles.captionTitle}>{playback.title}</span></Link>}
    </PlaybackHost>}
  </Context.Provider>;
}
