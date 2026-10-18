import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
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
        {note.inactiveAnchors.length || note.reanchorRequired ? <button type="button" disabled={busy} onClick={() => onReanchor(note)}>{m.noteReanchor}</button> : null}
        {note.sentenceIds[0] ? <button type="button" disabled={busy} onClick={() => onJump(note.sentenceIds[0])}>{m.noteJump}</button> : null}
        <button type="button" disabled={busy} onClick={() => onEdit(note)}>{m.noteEdit}</button><button type="button" disabled={busy} onClick={() => onDelete(note)}>{m.noteDelete}</button>
      </div>
    </article>)}
  </div>;
}
