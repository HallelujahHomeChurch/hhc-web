import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {ArrowUpRight, Pencil, Trash2, LocateFixed} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {ReaderMessages} from './ReaderToolbar';

export function NotesPanel({messages: m, notes, onJump, onEdit, onDelete, onReanchor, busy = false}: {
  messages: ReaderMessages; notes: readonly BulletinReaderNote[]; onJump: (sentenceId: string) => void;
  onEdit: (note: BulletinReaderNote) => void; onDelete: (note: BulletinReaderNote) => void;
  onReanchor: (note: BulletinReaderNote) => void; busy?: boolean;
}) {
  const visible = useMemo(() => notes.filter(note => !note.deleted), [notes]);
  const root = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const deleting = useRef<{id: string; index: number} | null>(null);
  useLayoutEffect(() => {
    const target = deleting.current;
    if (!target || visible.some(note => note.id === target.id)) return;
    deleting.current = null;
    requestAnimationFrame(() => {
      if (!root.current || document.activeElement !== document.body && document.activeElement?.isConnected) return;
      const adjacent = root.current.querySelectorAll('article')[Math.min(target.index, visible.length - 1)];
      (adjacent?.querySelector<HTMLElement>('button:not(:disabled)') ?? heading.current)?.focus({preventScroll: true});
    });
  }, [visible]);
  return <div ref={root} className="reader-notes-list">
    <h3 ref={heading} className="hhc-sr-only" tabIndex={-1}>{m.notesTab}</h3>
    {!visible.length ? <p>{m.noteEmpty}</p> : visible.map(note => <article key={note.id}>
      <blockquote>{note.quote}</blockquote><p className="reader-note-text">{note.text}</p>
      {note.inactiveAnchors.length || note.reanchorRequired ? <p>{m.noteRemoved}</p> : null}
      <div className="reader-note-actions">
        {note.inactiveAnchors.length || note.reanchorRequired ? <ReaderIconButton variant="ghost" aria-label={m.noteReanchor} isDisabled={busy} onPress={() => onReanchor(note)} icon={<LocateFixed size={18} aria-hidden="true"/>}/> : null}
        {note.sentenceIds[0] ? <ReaderIconButton variant="ghost" aria-label={m.noteJump} isDisabled={busy} onPress={() => onJump(note.sentenceIds[0])} icon={<ArrowUpRight size={18} aria-hidden="true"/>}/> : null}
        <ReaderIconButton variant="ghost" aria-label={m.noteEdit} isDisabled={busy} onPress={() => onEdit(note)} icon={<Pencil size={18} aria-hidden="true"/>}/>
        <ReaderIconButton variant="ghost" aria-label={m.noteDelete} isDisabled={busy} onPress={() => {deleting.current = {id: note.id, index: visible.indexOf(note)}; onDelete(note);}} icon={<Trash2 size={18} aria-hidden="true"/>}/>
      </div>
    </article>)}
  </div>;
}
