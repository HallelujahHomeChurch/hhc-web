import {useEffect, useId, useRef, useState} from 'react';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {ReaderActionError} from '@/features/weekly-reader/usePrivateReader';
import type {ReaderMessages} from './ReaderToolbar';

export type NoteSave = {text: string; noteId?: string; baseVersion?: number};
export type NoteSaveResult = {status: 'applied' | 'queued' | 'note_conflict'; note?: BulletinReaderNote; durable?: boolean};
export type NoteEditorState = {draft: NoteSave; conflict: NoteSaveResult | null};
export function NoteEditor({messages: m, note, quote, onSave, onComplete, onCancel, editorState, onEditorStateChange, onRecover, onKeepCloud = onCancel, failureHandled = false}: {
  messages: ReaderMessages; note?: BulletinReaderNote; quote: string;
  onSave: (draft: NoteSave) => Promise<NoteSaveResult>; onComplete: (status: 'applied' | 'queued') => void; onCancel: () => void;
  failureHandled?: boolean; onKeepCloud?: () => void; onRecover?: () => void; editorState?: NoteEditorState; onEditorStateChange?: (state: NoteEditorState) => void;
}) {
  const [internal, setInternal] = useState<NoteEditorState>({draft: {text: note?.text ?? '', ...(note ? {noteId: note.id, baseVersion: note.version} : {})}, conflict: null});
  const {draft, conflict} = editorState ?? internal;
  function update(state: NoteEditorState) {setInternal(state); onEditorStateChange?.(state);}
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // Let the house modal install its iOS focus/keyboard scroll handling first.
  useEffect(() => {
    const input = textarea.current, body = input?.parentElement;
    if (!input || !body) return;
    input.focus();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (input.ownerDocument.activeElement !== input) return;
      const field = input.getBoundingClientRect(), visible = body.getBoundingClientRect(), style = getComputedStyle(body);
      const top = visible.top + (parseFloat(style.paddingTop) || 0), bottom = visible.bottom - (parseFloat(style.paddingBottom) || 0);
      if (field.bottom > bottom) body.scrollTop += field.bottom - bottom;
      else if (field.top < top) body.scrollTop += field.top - top;
    });
    observer?.observe(body);
    return () => observer?.disconnect();
  }, []);
  const length = [...draft.text].length;
  async function save() {
    if (saving.current || conflict || !draft.text.trim() || length > 10000) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      const result = await onSave(draft);
      if (result.status === 'note_conflict') update({draft, conflict: result});
      else onComplete(result.status);
    } catch (failure) {if (!(failure instanceof ReaderActionError)) setError(true);}
    finally {saving.current = false; setBusy(false);}
  }
  function chooseLocal(manual: boolean) {
    const cloud = conflict?.note;
    if (!cloud || cloud.deleted) return;
    update({draft: {text: manual && cloud && !cloud.deleted ? `${cloud.text}\n\n${draft.text}` : draft.text,
      ...(cloud && !cloud.deleted ? {noteId: cloud.id, baseVersion: cloud.version} : {})}, conflict: null});
    textarea.current?.focus();
  }
  return <form className="reader-note-editor" onSubmit={event => {event.preventDefault(); void save();}}>
    <div className="reader-note-editor-body">
    <blockquote>{quote}</blockquote>
    {note?.inactiveAnchors.length || note?.reanchorRequired ? <p>{m.noteRemoved}</p> : null}
    <label htmlFor={id}>{m.noteText}</label>
    <textarea ref={textarea} id={id} rows={8} value={draft.text} disabled={busy} aria-describedby={`${id}-count`} aria-invalid={length > 10000 || undefined} onChange={event => update({draft: {...draft, text: event.target.value}, conflict})}/>
    {conflict ? <section className="reader-note-conflict" role="alert">
      <p>{m.noteConflict}</p><blockquote>{conflict.note && !conflict.note.deleted ? conflict.note.text : m.noteDeleted}</blockquote>
      <div className="reader-note-actions">{conflict.durable ? <button type="button" onClick={onRecover}>{m.reviewSync}</button> : <><button type="button" onClick={onKeepCloud}>{m.noteCloud}</button>{conflict.note && !conflict.note.deleted ? <><button type="button" onClick={() => chooseLocal(false)}>{m.noteLocal}</button><button type="button" onClick={() => chooseLocal(true)}>{m.noteManual}</button></> : null}</>}</div>
    </section> : null}
    {error && !failureHandled ? <p role="alert">{m.actionFailed}</p> : null}
    </div>
    <footer className="reader-note-actions"><p id={`${id}-count`}>{m.noteCount.replace('{count}', String(length))}</p><button type="button" disabled={busy} onClick={onCancel}>{m.noteCancel}</button><button type="submit" disabled={busy || !!conflict || !draft.text.trim() || length > 10000}>{m.noteSave}</button></footer>
  </form>;
}
