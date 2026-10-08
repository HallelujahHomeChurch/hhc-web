import {useMemo, useRef, useState} from 'react';
import {Button} from '@hallelujahhomechurch/ui';
import type {BulletinReaderHighlightColor, BulletinReaderMutation, BulletinReaderState, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from '@/features/weekly-reader/selection';
import {rangeQuote} from '@/features/weekly-reader/text-range';
import {useTextSelection} from '@/features/weekly-reader/useTextSelection';
import type {ReaderMessages} from './ReaderToolbar';

export function HighlightHistory({history = [], document, messages: m, busy, onSave}: {
  history?: BulletinReaderState['highlightHistory']; document: MemberOnlineDocument; messages: ReaderMessages; busy: boolean;
  onSave: (mutation: BulletinReaderMutation) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null), [error, setError] = useState(false);
  const [color, setColor] = useState<BulletinReaderHighlightColor>('yellow');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false), root = useRef<HTMLDivElement>(null);
  const sentences = useMemo(() => readerSentences(document), [document]);
  const {selection, clear} = useTextSelection(root, sentences, {ids: []}, busy || saving || !editing);
  const entries = history.filter(entry => entry.highlight);
  async function save(id: string, restore: boolean) {
    if (pending.current || busy || restore && !selection.ranges?.length) return;
    pending.current = true; setSaving(true); setError(false);
    try {
      const common = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: document.revision};
      await onSave(restore ? {...common, kind: 'restoreHighlight', payload: {historyId: id, sentenceIds: selection.ids, ranges: selection.ranges!, color}} : {...common, kind: 'discardHighlightHistory', payload: {historyId: id}});
      setEditing(null); clear();
    } catch {setError(true);}
    finally {pending.current = false; setSaving(false);}
  }
  if (!entries.length) return null;
  return <section className="reader-highlights-list" aria-label={m.highlightHistory} data-reader-selection-tools>
    <h3>{m.highlightHistory}</h3>
    {error ? <p role="alert">{m.actionFailed}</p> : null}
    {entries.map(entry => <article key={entry.id}>
      <blockquote>{entry.highlight!.segments?.length ? entry.highlight!.segments.map(part => [...entry.highlight!.quote].slice(part.start, part.end).join('')).join(' … ') : entry.highlight!.quote}</blockquote>
      {editing === entry.id ? <>
        <fieldset disabled={busy || saving}><legend>{m.recoveryRange}</legend>
          <div ref={root} tabIndex={0} className="reader-recovery-anchors reader-recovery-text">{sentences.map(sentence => <p key={sentence.id}><span data-sentence-id={sentence.id} data-fragment-start="0" data-fragment-end={[...sentence.text].length}>{sentence.text}</span></p>)}</div>
          {selection.ranges?.length ? <blockquote>{rangeQuote(selection.ranges, sentences)}</blockquote> : null}
        </fieldset>
        <div className="reader-note-actions" role="group" aria-label={m.highlightColors}>{(['yellow', 'red', 'blue'] as const).map(value => <Button key={value} variant="ghost" className="reader-color" aria-label={m[`${value}Highlight`]} aria-pressed={value === color} isDisabled={busy || saving} onPress={() => setColor(value)}><span aria-hidden="true" data-color={value}/></Button>)}</div>
        <div className="reader-note-actions"><Button variant="ghost" isDisabled={busy || saving} onPress={() => {setEditing(null); clear();}}>{m.noteCancel}</Button><Button variant="secondary" isDisabled={busy || saving || !selection.ranges?.length} onPress={() => {void save(entry.id, true);}}>{m.noteSave}</Button></div>
      </> : <div className="reader-note-actions"><Button variant="secondary" isDisabled={busy || saving} onPress={() => {clear(); setError(false); setColor(entry.highlight!.color); setEditing(entry.id);}}>{m.highlightRestore}</Button><Button variant="ghost" isDisabled={busy || saving} onPress={() => {if (window.confirm(m.highlightHistoryDelete)) void save(entry.id, false);}}>{m.clearHighlight}</Button></div>}
    </article>)}
  </section>;
}
