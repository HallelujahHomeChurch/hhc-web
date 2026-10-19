import {useCallback, type ReactNode} from 'react';
import {Drawer} from '@hallelujahhomechurch/ui';
import {X} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {ReaderSyncStatus} from '@/features/weekly-reader/sync';
import type {ReaderMessages} from './ReaderToolbar';

export function SyncStatus({status, messages: m, children}: {status: ReaderSyncStatus; messages: ReaderMessages; children?: ReactNode}) {
  return <p className="reader-sync-status" role="status">{children ?? ({synced: m.syncSynced, waiting: m.syncWaiting, syncing: m.syncSyncing, action: m.syncAction, paused: m.syncPaused})[status]}</p>;
}

export function ReaderPrivateState({wide, title, theme, messages: m, children, onClose, suspended = false}: {wide: boolean; title?: string; theme: 'light' | 'dark'; messages: ReaderMessages; children: ReactNode; onClose: () => void; suspended?: boolean}) {
  const attachSheet = useCallback((node: HTMLDivElement | null) => {
    const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay');
    if (!overlay) return;
    overlay.dataset.theme = theme; overlay.style.colorScheme = theme;
    const visual = window.visualViewport;
    const measure = () => {
      const height = visual?.height ?? window.innerHeight;
      overlay.style.setProperty('--reader-sheet-height', `${Math.max(0, height - Math.min(124, height * .25))}px`);
      overlay.style.setProperty('--reader-sheet-bottom', `${Math.max(0, window.innerHeight - height - (visual?.offsetTop ?? 0))}px`);
    };
    measure(); visual?.addEventListener('resize', measure); visual?.addEventListener('scroll', measure); window.addEventListener('resize', measure);
    return () => {visual?.removeEventListener('resize', measure); visual?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure);};
  }, [theme]);
  if (wide) return <aside className="reader-private-panel" aria-label={title ?? m.myNotes}><header><h2>{title ?? m.myNotes}</h2><ReaderIconButton variant="ghost" aria-label={m.noteClose} onPress={onClose} icon={<X size={20} aria-hidden="true"/>}/></header>{children}</aside>;
  return <Drawer title={title ?? m.myNotes} closeLabel={m.noteClose} isOpen onOpenChange={open => {if (!open && !suspended) onClose();}}><div className="reader-private-sheet" ref={attachSheet} hidden={suspended} inert={suspended}>{children}</div></Drawer>;
}
