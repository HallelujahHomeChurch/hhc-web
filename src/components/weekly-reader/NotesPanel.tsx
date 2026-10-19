import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {ArrowUpRight, Pencil, Trash2, LocateFixed} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {ReaderMessages} from './ReaderToolbar';

export function NotesPanel({messages: m, notes, onJump, onEdit, onDelete, onReanchor, busy = false}: {
  messages: ReaderMessages; notes: readonly BulletinReaderNote[]; onJump: (sentenceId: string) => void;
  onEdit: (note: BulletinReaderNote) => void; onDelete: (note: BulletinReaderNote) => void;
  onReanchor: (note: BulletinReaderNote) => void; busy?: boolean;
}) {
  const visible = notes.filter(note => !note.deleted);
  return <div className="reader-notes-list">
    {!visible.length ? <p>{m.noteEmpty}</p> : visible.map(note => <article key={note.id}>
      <blockquote>{note.quote}</blockquote><p className="reader-note-text">{note.text}</p>
      {note.inactiveAnchors.length || note.reanchorRequired ? <p>{m.noteRemoved}</p> : null}
      <div className="reader-note-actions">
        {note.inactiveAnchors.length || note.reanchorRequired ? <ReaderIconButton variant="ghost" aria-label={m.noteReanchor} isDisabled={busy} onPress={() => onReanchor(note)} icon={<LocateFixed size={18} aria-hidden="true"/>}/> : null}
        {note.sentenceIds[0] ? <ReaderIconButton variant="ghost" aria-label={m.noteJump} isDisabled={busy} onPress={() => onJump(note.sentenceIds[0])} icon={<ArrowUpRight size={18} aria-hidden="true"/>}/> : null}
        <ReaderIconButton variant="ghost" aria-label={m.noteEdit} isDisabled={busy} onPress={() => onEdit(note)} icon={<Pencil size={18} aria-hidden="true"/>}/>
        <ReaderIconButton variant="ghost" aria-label={m.noteDelete} isDisabled={busy} onPress={() => onDelete(note)} icon={<Trash2 size={18} aria-hidden="true"/>}/>
      </div>
    </article>)}
  </div>;
}
