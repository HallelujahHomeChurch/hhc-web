import {useCallback, useState, type ReactNode, type RefObject} from 'react';
import {Drawer} from '@hallelujahhomechurch/ui';
import {X} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {ReaderSyncStatus} from '@/features/weekly-reader/sync';
import type {ReaderMessages} from './ReaderToolbar';

export function SyncStatus({status, messages: m, children}: {status: ReaderSyncStatus; messages: ReaderMessages; children?: ReactNode}) {
  return <p className="reader-sync-status" role="status">{children ?? ({synced: m.syncSynced, waiting: m.syncWaiting, syncing: m.syncSyncing, action: m.syncAction, paused: m.syncPaused})[status]}</p>;
}

export function ReaderPrivateState({wide, title, theme, messages: m, children, onClose, suspended = false, headerRef, isOpen = true, feedback, compact = false}: {wide: boolean; title?: string; theme: 'light' | 'dark'; messages: ReaderMessages; children: ReactNode; onClose: () => void; suspended?: boolean; headerRef?: RefObject<HTMLElement | null>; isOpen?: boolean; feedback?: ReactNode; compact?: boolean}) {
  // Retain the last open body during the house overlay's exit animation.
  const [displayed, setDisplayed] = useState({children, title, compact});
  if (isOpen && (displayed.children !== children || displayed.title !== title || displayed.compact !== compact)) setDisplayed({children, title, compact});
  const attachSheet = useCallback((node: HTMLDivElement | null) => {
    const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay');
    if (!overlay) return;
    overlay.dataset.theme = theme; overlay.style.colorScheme = theme;
    const visual = window.visualViewport;
    const measure = () => {
      const height = visual?.height ?? window.innerHeight;
      const header = headerRef?.current;
      const headerBottom = (header?.closest('.weekly-reader')?.getBoundingClientRect().top ?? 0) + (header?.offsetHeight ?? 0);
      const gap = Math.min(height * .25, Math.max(0, headerBottom - (visual?.offsetTop ?? 0) + 16));
      overlay.style.setProperty('--reader-sheet-height', `${Math.max(0, height - gap)}px`);
      overlay.style.setProperty('--reader-viewport-top', `${visual?.offsetTop ?? 0}px`);
      overlay.style.setProperty('--reader-viewport-height', `${height}px`);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (headerRef?.current) observer?.observe(headerRef.current);
    measure(); visual?.addEventListener('resize', measure); visual?.addEventListener('scroll', measure); window.addEventListener('resize', measure);
    return () => {observer?.disconnect(); visual?.removeEventListener('resize', measure); visual?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure);};
  }, [theme, headerRef]);
  if (wide) return <aside hidden={!isOpen} className="reader-private-panel" aria-label={title ?? m.myNotes}><header><h2>{title ?? m.myNotes}</h2><ReaderIconButton variant="ghost" aria-label={m.noteClose} onPress={onClose} icon={<X size={20} aria-hidden="true"/>}/></header>{feedback}{children}</aside>;
  return <Drawer title={(isOpen ? title : displayed.title) ?? m.myNotes} closeLabel={m.noteClose} isOpen={isOpen} onOpenChange={open => {if (!open && !suspended) onClose();}}><div className="reader-private-sheet" data-compact={(isOpen ? compact : displayed.compact) || undefined} ref={attachSheet} hidden={suspended} inert={suspended || !isOpen}>{feedback}{isOpen ? children : displayed.children}</div></Drawer>;
}
