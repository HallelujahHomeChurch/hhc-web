'use client';

import {createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {ArrowUpRight, X} from 'lucide-react';
import {useAccountIdentity, useVideoAccess} from '@/components/layout/AccountControl';
import {useMediaDocument} from '@/components/layout/MediaDocument';
import type {ContinuityLabels} from './ContinueWatching';
import {PlaybackHost} from './PlaybackHost';

type Playback = {key: string; href: string; title: string; player: ReactNode};
type Slot = {key: string; element: HTMLElement};
type PlaybackControl = {
  activeKey: string | undefined;
  activeHref: string | undefined;
  labels: ContinuityLabels;
  inWatch: boolean;
  start: (playback: Playback, explicit?: boolean) => void;
  setSlot: (key: string, element: HTMLElement | null) => void;
  close: (key: string) => void;
  rememberLibrary: (href: string, scroll: number) => void;
  returnToLibrary: (fallback: string) => {href: string; scroll: number};
  takeLibraryScroll: () => number | undefined;
  registerPlayback: (flush: () => void, time: () => number) => () => void;
  currentTime: () => number;
};
const ContinueWatching = dynamic(() => import('./ContinueWatching').then(module => module.ContinueWatching), {ssr: false});

const Context = createContext<PlaybackControl | null>(null);
export const usePersistentPlayback = () => useContext(Context);

type Props = {children: ReactNode; locale: string; labels: ContinuityLabels};

export function PlaybackProvider({children, locale, labels}: Props) {
  const identity = useAccountIdentity();
  const access = useVideoAccess();
  const {privateMediaReady} = useMediaDocument();
  const member = access === 'available' && privateMediaReady ? identity : null;
  return <MemberPlaybackProvider member={member} locale={locale} labels={labels}>{children}</MemberPlaybackProvider>;
}

function MemberPlaybackProvider({children, locale, labels, member}: Props & {member: string | null}) {
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [slot, setWatchSlot] = useState<Slot | null>(null);
  const [dismissed, dismiss] = useState<string>();
  const [closed, setClosed] = useState<string>();
  const [owner, setOwner] = useState(member);
  if (member !== owner) {
    setOwner(member);
    setPlayback(null);
    setWatchSlot(null);
    dismiss(undefined);
    setClosed(undefined);
  }
  const library = useRef<{member: string | null; href: string; scroll: number} | undefined>(undefined);
  const restoreScroll = useRef<number | undefined>(undefined);
  const rememberLibrary = useCallback((href: string, scroll: number) => { library.current = {member, href, scroll}; }, [member]);
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
  const playbackAccess = useRef<{flush: () => void; time: () => number} | null>(null);
  const previousPlaybackKey = playback?.key;
  const start = useCallback((next: Playback, explicit = false) => {
    if (!explicit && closed === next.key) return;
    if (previousPlaybackKey && previousPlaybackKey !== next.key) playbackAccess.current?.flush();
    setPlayback(next);
    if (explicit) setClosed(undefined);
  }, [closed, previousPlaybackKey]);
  const setSlot = useCallback((key: string, element: HTMLElement | null) => {
    setWatchSlot(current => element ? {key, element} : current?.key === key ? null : current);
    if (!element) setClosed(current => current === key ? undefined : current);
  }, []);
  const close = useCallback((key: string) => {
    setClosed(key);
    setPlayback(current => current?.key === key ? null : current);
  }, []);
  const registerPlayback = useCallback((flush: () => void, time: () => number) => {
    const value = {flush, time};
    playbackAccess.current = value;
    return () => { if (playbackAccess.current === value) playbackAccess.current = null; };
  }, []);
  const currentTime = useCallback(() => playbackAccess.current?.time() ?? 0, []);
  const activeKey = playback?.key;
  const activeHref = playback?.href;
  const closeActive = useCallback(() => { if (activeKey) { playbackAccess.current?.flush(); close(activeKey); } }, [activeKey, close]);
  const watchSlot = playback && slot?.key === playback.key ? slot.element : null;
  const inWatch = Boolean(watchSlot);
  const controls = useMemo(() => ({activeKey, activeHref, start, setSlot, close, labels, inWatch, registerPlayback, currentTime, rememberLibrary, returnToLibrary, takeLibraryScroll}), [activeKey, activeHref, start, setSlot, close, labels, inWatch, registerPlayback, currentTime, rememberLibrary, returnToLibrary, takeLibraryScroll]);

  return <Context.Provider value={member ? controls : null}>
    {children}
    {member && !playback && !slot && <ContinueWatching locale={locale} labels={labels} dismissed={dismissed} dismiss={dismiss}/>}
    {member && playback && <PlaybackHost watchSlot={watchSlot} onClose={closeActive} moveLabel={labels.move} resizeLabel={labels.resize}>
      <div key={playback.key}>{playback.player}</div>
      {!watchSlot && <div className="absolute right-0 top-0 z-10 flex rounded-bl-lg bg-black/80 text-white">
        <Link href={playback.href} aria-label={`${labels.expand} · ${playback.title}`} className="grid size-11 place-items-center"><ArrowUpRight size={20}/></Link>
        <button type="button" aria-label={labels.close} className="grid size-11 place-items-center" onClick={closeActive}><X size={20}/></button>
      </div>}
    </PlaybackHost>}
  </Context.Provider>;
}
