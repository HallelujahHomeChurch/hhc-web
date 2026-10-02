import type {ReactNode} from 'react';
import {Drawer} from '@hallelujahhomechurch/ui';
import type {ReaderSyncStatus} from '@/features/weekly-reader/sync';
import type {ReaderMessages} from './ReaderToolbar';

export function SyncStatus({status, messages: m}: {status: ReaderSyncStatus; messages: ReaderMessages}) {
  return <p className="reader-sync-status" role="status">{({synced: m.syncSynced, waiting: m.syncWaiting, syncing: m.syncSyncing, action: m.syncAction, paused: m.syncPaused})[status]}</p>;
}

export function ReaderPrivateState({wide, messages: m, children, onClose, suspended = false}: {wide: boolean; messages: ReaderMessages; children: ReactNode; onClose: () => void; suspended?: boolean}) {
  if (wide) return <aside className="reader-private-panel" aria-label={m.myNotes}><header><h2>{m.myNotes}</h2><button type="button" onClick={onClose}>{m.noteClose}</button></header>{children}</aside>;
  return <Drawer title={m.myNotes} closeLabel={m.noteClose} isOpen onOpenChange={open => {if (!open && !suspended) onClose();}}><div className="reader-private-sheet" hidden={suspended} inert={suspended}>{children}</div></Drawer>;
}
