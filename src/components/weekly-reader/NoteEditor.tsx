import {useId, useRef, useState} from 'react';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderMessages} from './ReaderToolbar';

export type NoteSave = {text: string; noteId?: string; baseVersion?: number};
export type NoteSaveResult = {status: 'applied' | 'queued' | 'note_conflict'; note?: BulletinReaderNote};
export type NoteEditorState = {draft: NoteSave; conflict: NoteSaveResult | null};
export function NoteEditor({messages: m, note, quote, onSave, onComplete, onCancel, editorState, onEditorStateChange}: {
  messages: ReaderMessages; note?: BulletinReaderNote; quote: string;
  onSave: (draft: NoteSave) => Promise<NoteSaveResult>; onComplete: (status: 'applied' | 'queued') => void; onCancel: () => void;
  editorState?: NoteEditorState; onEditorStateChange?: (state: NoteEditorState) => void;
}) {
  const [internal, setInternal] = useState<NoteEditorState>({draft: {text: note?.text ?? '', ...(note ? {noteId: note.id, baseVersion: note.version} : {})}, conflict: null});
  const {draft, conflict} = editorState ?? internal;
  function update(state: NoteEditorState) {setInternal(state); onEditorStateChange?.(state);}
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const length = [...draft.text].length;
  async function save() {
    if (saving.current || conflict || !draft.text.trim() || length > 10000) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      const result = await onSave(draft);
      if (result.status === 'note_conflict') update({draft, conflict: result});
      else onComplete(result.status);
    } catch {setError(true);}
    finally {saving.current = false; setBusy(false);}
  }
  function chooseLocal(manual: boolean) {
    const cloud = conflict?.note;
    update({draft: {text: manual && cloud && !cloud.deleted ? `${cloud.text}\n\n${draft.text}` : draft.text,
      ...(cloud && !cloud.deleted ? {noteId: cloud.id, baseVersion: cloud.version} : {})}, conflict: null});
    textarea.current?.focus();
  }
  return <form className="reader-note-editor" onSubmit={event => {event.preventDefault(); void save();}}>
    <blockquote>{quote}</blockquote>
    {note?.inactiveAnchors.length || note?.reanchorRequired ? <p>{m.noteRemoved}</p> : null}
    <label htmlFor={id}>{m.noteText}</label>
    <textarea ref={textarea} id={id} autoFocus rows={8} value={draft.text} disabled={busy} aria-describedby={`${id}-count`} aria-invalid={length > 10000 || undefined} onChange={event => update({draft: {...draft, text: event.target.value}, conflict})}/>
    <p id={`${id}-count`}>{m.noteCount.replace('{count}', String(length))}</p>
    {conflict ? <section className="reader-note-conflict" role="alert">
      <p>{m.noteConflict}</p><blockquote>{conflict.note && !conflict.note.deleted ? conflict.note.text : m.noteDeleted}</blockquote>
      <div className="reader-note-actions"><button type="button" onClick={onCancel}>{m.noteCloud}</button><button type="button" onClick={() => chooseLocal(false)}>{m.noteLocal}</button><button type="button" onClick={() => chooseLocal(true)}>{m.noteManual}</button></div>
    </section> : null}
    {error ? <p role="alert">{m.actionFailed}</p> : null}
    <div className="reader-note-actions"><button type="button" disabled={busy} onClick={onCancel}>{m.noteCancel}</button><button type="submit" disabled={busy || !!conflict || !draft.text.trim() || length > 10000}>{m.noteSave}</button></div>
  </form>;
}
