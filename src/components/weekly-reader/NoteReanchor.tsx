import {useMemo, useRef, useState} from 'react';
import type {BulletinReaderNote, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from '@/features/weekly-reader/selection';
import {rangeQuote, type ReaderTextRange} from '@/features/weekly-reader/text-range';
import {useReaderSelection} from '@/features/weekly-reader/useReaderSelection';
import type {NoteSaveResult} from './NoteEditor';
import type {ReaderMessages} from './ReaderToolbar';

export function NoteReanchor({note, document, messages: m, onSave, onComplete, onCancel, suspended = false, mobile = false}: {
  note: BulletinReaderNote; document: MemberOnlineDocument; messages: ReaderMessages; suspended?: boolean; mobile?: boolean;
  onSave: (note: BulletinReaderNote, ranges: ReaderTextRange[]) => Promise<NoteSaveResult>;
  onComplete: () => void; onCancel: () => void;
}) {
  const [current, setCurrent] = useState(note);
  const [conflict, setConflict] = useState<NoteSaveResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const saving = useRef(false), root = useRef<HTMLDivElement>(null);
  const sentences = useMemo(() => readerSentences(document), [document]);
  const {selection, clear} = useReaderSelection(root, sentences, {ids: []}, busy || suspended || !!conflict, mobile ? 'sentence' : 'text');
  const ranges = selection.ranges ?? sentences.filter(sentence => selection.ids.includes(sentence.id)).map(sentence => ({sentenceId:sentence.id,start:0,end:[...sentence.text].length}));
  let quote = '';
  try {if (ranges.length) quote = rangeQuote(ranges, sentences);} catch { /* Reanchoring requires one contiguous passage. */ }
  async function save() {
    if (saving.current || suspended || conflict || !quote) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      const result = await onSave(current, ranges);
      if (result.status === 'note_conflict') setConflict(result);
      else onComplete();
    } catch {setError(true);}
    finally {saving.current = false; setBusy(false);}
  }
  return <form className="reader-note-editor" data-reader-selection-tools onSubmit={event => {event.preventDefault(); void save();}}>
    <blockquote>{current.quote}</blockquote><p className="reader-note-text">{current.text}</p>
    <fieldset disabled={busy || suspended || !!conflict}><legend>{m.recoveryRange}</legend>
      <div ref={root} tabIndex={0} data-sentence-selection={mobile || undefined} className="reader-recovery-anchors reader-recovery-text">{sentences.map(sentence => <p key={sentence.id}><span role={mobile?'button':undefined} tabIndex={mobile?0:undefined} aria-pressed={mobile?selection.ids.includes(sentence.id):undefined} data-selected={mobile&&selection.ids.includes(sentence.id)||undefined} data-sentence-id={sentence.id} data-fragment-start="0" data-fragment-end={[...sentence.text].length}>{sentence.text}</span></p>)}</div>
      {quote ? <blockquote>{quote}</blockquote> : null}
    </fieldset>
    {conflict ? <section role="alert"><p>{m.noteConflict}</p><blockquote>{conflict.note && !conflict.note.deleted ? conflict.note.text : m.noteDeleted}</blockquote>
      {conflict.note && !conflict.note.deleted && (conflict.note.reanchorRequired || conflict.note.inactiveAnchors.length > 0) ? <button type="button" disabled={suspended} onClick={() => {setCurrent(conflict.note!); setConflict(null); clear();}}>{m.retry}</button> : null}
    </section> : null}
    {error ? <p role="alert">{m.actionFailed}</p> : null}
    <div className="reader-note-actions"><button type="button" disabled={busy} onClick={onCancel}>{m.noteCancel}</button><button type="submit" disabled={busy || suspended || !!conflict || !quote}>{m.noteSave}</button></div>
  </form>;
}
