import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Button} from '@hallelujahhomechurch/ui';
import type {BulletinReaderHighlightColor, BulletinReaderMutation, BulletinReaderState, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from '@/features/weekly-reader/selection';
import {selectionPassage} from '@/features/weekly-reader/text-range';
import {useReaderSelection, type ReaderSelection} from '@/features/weekly-reader/useReaderSelection';
import {PassageText} from './PassageText';
import type {ReaderMessages} from './ReaderToolbar';

export type HistoryDraft = {editing: string | null; color: BulletinReaderHighlightColor; selection: ReaderSelection};

export function HighlightHistory({history = [], document, messages: m, busy, onSave, mobile = false, initialDraft, onDraftChange, onConfirm}: {
  onConfirm: (description: string) => Promise<boolean>;
  initialDraft?: HistoryDraft; onDraftChange?: (draft: HistoryDraft) => void;
  history?: BulletinReaderState['highlightHistory']; document: MemberOnlineDocument; messages: ReaderMessages; busy: boolean; mobile?: boolean;
  onSave: (mutation: BulletinReaderMutation) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(initialDraft?.editing ?? null), [error, setError] = useState(false);
  const [color, setColor] = useState<BulletinReaderHighlightColor>(initialDraft?.color ?? 'yellow');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false), root = useRef<HTMLDivElement>(null);
  const sentences = useMemo(() => readerSentences(document), [document]);
  const {selection, clear} = useReaderSelection(root, sentences, initialDraft?.selection ?? {ids: []}, busy || saving || !editing, mobile ? 'sentence' : 'text');
  useEffect(() => {onDraftChange?.({editing, color, selection});}, [editing, color, selection, onDraftChange]);
  const {ranges, quote} = selectionPassage(selection, sentences);
  const entries = history.filter(entry => entry.highlight);
  const current = useRef({history, document, busy, mounted: false});
  useLayoutEffect(() => {current.current = {history, document, busy, mounted: true};});
  useLayoutEffect(() => () => {current.current.mounted = false;}, []);
  async function save(id: string, restore: boolean) {
    if (pending.current || busy || restore && !quote) return;
    const original = history.find(entry => entry.id === id);
    if (!original?.highlight) return;
    const fingerprint = JSON.stringify(original);
    pending.current = true; setSaving(true); setError(false);
    try {
      if (!restore && !await onConfirm(m.highlightHistoryDelete)) return;
      const latest = current.current;
      if (!latest.mounted || latest.busy || latest.document.documentId !== document.documentId || latest.document.revision !== document.revision || JSON.stringify(latest.history.find(entry => entry.id === id)) !== fingerprint) return;
      const common = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: document.revision};
      await onSave(restore ? {...common, kind: 'restoreHighlight', payload: {historyId: id, sentenceIds: selection.ids, ranges, color}} : {...common, kind: 'discardHighlightHistory', payload: {historyId: id}});
      setEditing(null); clear();
    } catch {setError(true);}
    finally {pending.current = false; setSaving(false);}
  }
  if (!entries.length) return <p>{m.historyEmpty}</p>;
  return <section className="reader-highlights-list" aria-label={m.highlightHistory} data-reader-selection-tools>
    <h3>{m.highlightHistory}</h3>
    {error ? <p role="alert">{m.actionFailed}</p> : null}
    {entries.map(entry => <article key={entry.id}>
      <blockquote>{entry.highlight!.segments?.length ? entry.highlight!.segments.map(part => [...entry.highlight!.quote].slice(part.start, part.end).join('')).join(' … ') : entry.highlight!.quote}</blockquote>
      {editing === entry.id ? <>
        <fieldset disabled={busy || saving}><legend>{m.recoveryRange}</legend>
          <PassageText root={root} sentences={sentences} selection={selection} mobile={mobile} tabIndex={0}/>
          {quote ? <blockquote>{quote}</blockquote> : null}
        </fieldset>
        <div className="reader-note-actions" role="group" aria-label={m.highlightColors}>{(['yellow', 'red', 'blue'] as const).map(value => <Button key={value} variant="ghost" className="reader-color" aria-label={m[`${value}Highlight`]} aria-pressed={value === color} isDisabled={busy || saving} onPress={() => setColor(value)}><span aria-hidden="true" data-color={value}/></Button>)}</div>
        <div className="reader-note-actions"><Button variant="ghost" isDisabled={busy || saving} onPress={() => {setEditing(null); clear();}}>{m.noteCancel}</Button><Button variant="secondary" isDisabled={busy || saving || !quote} onPress={() => {void save(entry.id, true);}}>{m.noteSave}</Button></div>
      </> : <div className="reader-note-actions"><Button variant="secondary" isDisabled={busy || saving} onPress={() => {clear(); setError(false); setColor(entry.highlight!.color); setEditing(entry.id);}}>{m.highlightRestore}</Button><Button variant="ghost" isDisabled={busy || saving} onPress={() => {void save(entry.id, false);}}>{m.clearHighlight}</Button></div>}
    </article>)}
  </section>;
}
