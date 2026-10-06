import type {ReactNode} from 'react';
import {Drawer} from '@hallelujahhomechurch/ui';
import {X} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {ReaderSyncStatus} from '@/features/weekly-reader/sync';
import type {ReaderMessages} from './ReaderToolbar';

export function SyncStatus({status, messages: m}: {status: ReaderSyncStatus; messages: ReaderMessages}) {
  return <p className="reader-sync-status" role="status">{({synced: m.syncSynced, waiting: m.syncWaiting, syncing: m.syncSyncing, action: m.syncAction, paused: m.syncPaused})[status]}</p>;
}

export function ReaderPrivateState({wide, theme, messages: m, children, onClose, suspended = false}: {wide: boolean; theme: 'light' | 'dark'; messages: ReaderMessages; children: ReactNode; onClose: () => void; suspended?: boolean}) {
  if (wide) return <aside className="reader-private-panel" aria-label={m.myNotes}><header><h2>{m.myNotes}</h2><ReaderIconButton variant="ghost" aria-label={m.noteClose} onPress={onClose} icon={<X size={20} aria-hidden="true"/>}/></header>{children}</aside>;
  return <Drawer title={m.myNotes} closeLabel={m.noteClose} isOpen onOpenChange={open => {if (!open && !suspended) onClose();}}><div className="reader-private-sheet" ref={node => {
    // Drawer portals outside the reader; theme only its own overlay, not the website.
    const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay');
    if (overlay) {overlay.dataset.theme = theme; overlay.style.colorScheme = theme;}
  }} hidden={suspended} inert={suspended}>{children}</div></Drawer>;
}
