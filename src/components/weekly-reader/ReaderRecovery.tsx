import {useEffect, useMemo, useRef, useState} from 'react';
import {Drawer} from '@hallelujahhomechurch/ui';
import type {BulletinReaderHighlightColor, BulletinReaderMutation, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from '@/features/weekly-reader/api';
import {chooseReaderRecovery, getOfflineIdentity, readOfflineSave, supportsOfflineReader} from '@/features/weekly-reader/offline-store';
import {finishReaderUpgrade, prepareReaderUpgrade, type ReaderUpgrade} from '@/features/weekly-reader/upgrade';
import {manualReaderRecovery} from '@/features/weekly-reader/rebase';
import {readerSentences} from '@/features/weekly-reader/selection';
import {rangeQuote} from '@/features/weekly-reader/text-range';
import {useTextSelection} from '@/features/weekly-reader/useTextSelection';
import type {ReaderMessages} from './ReaderToolbar';

export function ReaderRecovery({api, value, selector, messages: m, onUpdated, onFailure, suspended = false, pendingMutation = null, onPendingChange}: {
  api: ReturnType<typeof createReaderApi>; value: OnlineBulletinAccess; selector: ReaderSelector; messages: ReaderMessages;
  onUpdated: (value: OnlineBulletinAccess) => void; onFailure: (error: unknown) => void; suspended?: boolean;
  pendingMutation?: BulletinReaderMutation | null; onPendingChange?: (mutation: BulletinReaderMutation | null) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [prepared, setPrepared] = useState<ReaderUpgrade | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const epoch = useRef<number | null>(null), controller = useRef<AbortController | null>(null);
  const pending = useRef(pendingMutation);
  const acknowledged = useRef<{mutationId: string; status: string} | null>(null);
  useEffect(() => {pending.current = pendingMutation;}, [pendingMutation]);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (controller.current && !controller.current.signal.aborted) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError(false);
    try {await work(request.signal);}
    catch (failure) {if (!request.signal.aborted) {setError(true); onFailure(failure);}}
    finally {request.abort(); setBusy(false);}
  }
  async function prepare(signal: AbortSignal) {
    const saved = supportsOfflineReader() ? await readOfflineSave(selector) : null;
    if (saved && !pending.current) {
      const owner = await getOfflineIdentity();
      if (owner.accountId !== selector.accountId) throw new Error('offline_account_changed');
      epoch.current = owner.epoch;
      const next = await prepareReaderUpgrade(api, selector, value, owner.epoch, signal);
      signal.throwIfAborted(); setPrepared(next); setAwaitingConfirmation(false);
    } else {
      epoch.current = null;
      const current = await api.current(selector, value, crypto.randomUUID(), signal);
      const cloud = await api.privateState(selector, current, signal);
      signal.throwIfAborted();
      const mutation = pending.current;
      const expired = mutation && new Date().getTime() - Date.parse(mutation.createdAt) > 90 * 86400000;
      const reviewed = mutation && acknowledged.current?.mutationId === mutation.mutationId;
      setAwaitingConfirmation(Boolean(mutation && !reviewed && !expired));
      setPrepared({value: current, state: cloud.state, queue: mutation ? [{mutation, sent: true}] : [], mutations: [],
        recovery: mutation && (reviewed || expired) ? [{mutationId: mutation.mutationId, reason: expired ? 'expired_mutation' : acknowledged.current?.status === 'note_conflict' ? 'note_conflict' : 'mapping_unavailable'}] : [], previousRevision: value.document.revision});
    }
  }
  function remember(mutation: BulletinReaderMutation | null) {
    pending.current = mutation; acknowledged.current = null; onPendingChange?.(mutation);
  }
  async function retryPending(signal: AbortSignal) {
    if (!prepared || !pending.current) return;
    const response = await api.mutate(selector, prepared.value, [pending.current], signal);
    signal.throwIfAborted();
    if (response.results[0].status === 'applied') remember(null);
    else acknowledged.current = response.results[0];
    await prepare(signal);
  }
  async function choose(originalId: string | null, mutation: BulletinReaderMutation | null, signal: AbortSignal) {
    if (!prepared) return;
    if (epoch.current !== null) await chooseReaderRecovery(selector, originalId, mutation, epoch.current, prepared.queue);
    else {
      // Resolving a server-identified color conflict must not replace the user's
      // pending note/highlight. A consumed conflict ID cannot recolor it again.
      if (originalId === null && pending.current && mutation?.kind === 'resolveHighlightMigrationConflict') {
        const response = await api.mutate(selector, prepared.value, [mutation], signal);
        signal.throwIfAborted();
        if (response.results[0].status !== 'applied') throw new Error('action_required');
        await prepare(signal); return;
      }
      remember(mutation);
      if (mutation) {await retryPending(signal); return;}
    }
    await prepare(signal);
  }
  const conflict = prepared?.state.conflicts[0];
  const recovery = prepared?.recovery[0];
  const entry = prepared?.queue.find(entry => entry.mutation.mutationId === recovery?.mutationId);
  return <>
    <button type="button" onClick={() => {setOpen(true); setPrepared(null); void run(prepare);}}>{m.reviewSync}</button>
    {open ? <Drawer title={m.reviewSync} closeLabel={m.noteClose} isOpen onOpenChange={next => {if (!next && !busy && !suspended) setOpen(false);}}><div className="reader-private-sheet reader-recovery" hidden={suspended} inert={suspended}>
      <p>{m.recoveryHelp}</p>
      {busy ? <p role="status">{m.syncSyncing}</p> : null}
      {error ? <p role="alert">{m.actionFailed}</p> : null}
      {awaitingConfirmation ? <section><p>{m.confirmRetryHelp}</p><button type="button" disabled={busy} onClick={() => void run(retryPending)}>{m.confirmRetry}</button></section> : conflict && prepared ? <section><p>{m.recoveryColor}</p>{conflict.sources.map(source => <blockquote key={source.sentenceId}><span className="reader-color"><span data-color={source.color}/></span>{source.quote}</blockquote>)}<div className="reader-note-actions">{(['yellow', 'red', 'blue'] as const).map(color => <button key={color} className="reader-color" aria-label={m[`${color}Highlight`]} disabled={busy} onClick={() => void run(signal => choose(null, {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: prepared.value.document.revision, kind: 'resolveHighlightMigrationConflict', payload: {conflictId: conflict.id, chosenColor: color, currentRevision: prepared.value.document.revision}}, signal))}><span data-color={color}/></button>)}</div></section> :
        recovery && entry && prepared ? <RecoveryChoice key={`${recovery.mutationId}:${entry.resolution?.mutation?.mutationId ?? ''}:${prepared.state.notes.map(note => note.version).join(',')}`} prepared={prepared} previous={value} original={entry.resolution?.mutation ?? entry.mutation} reason={recovery.reason} messages={m} busy={busy} onChoose={mutation => void run(signal => choose(entry.mutation.mutationId, mutation, signal))}/> :
        prepared ? <button type="button" disabled={busy} onClick={() => void run(async signal => {
          const current = epoch.current === null ? prepared.value : await finishReaderUpgrade(api, selector, prepared, epoch.current, signal);
          signal.throwIfAborted(); onUpdated(current); setOpen(false);
        })}>{m.applyUpdate}</button> : null}
      {error ? <button type="button" disabled={busy} onClick={() => void run(prepare)}>{m.retry}</button> : null}
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>{m.keepReading}</button>
    </div></Drawer> : null}
  </>;
}

function RecoveryChoice({prepared, previous, original, reason, messages: m, busy, onChoose}: {
  prepared: ReaderUpgrade; previous: OnlineBulletinAccess; original: BulletinReaderMutation; reason: ReaderUpgrade['recovery'][number]['reason']; messages: ReaderMessages; busy: boolean; onChoose: (mutation: BulletinReaderMutation | null) => void;
}) {
  const sentences = useMemo(() => readerSentences(prepared.value.document), [prepared.value.document]);
  const rangeRoot = useRef<HTMLDivElement>(null);
  const partial = 'ranges' in original.payload;
  const {selection} = useTextSelection(rangeRoot, sentences, {ids: []}, !partial || busy);
  const cloud = original.kind === 'createNote' || original.kind === 'editNote' || original.kind === 'deleteNote' ? prepared.state.notes.find(note => note.id === original.payload.noteId && !note.deleted) : undefined;
  const sourceIds = original.kind === 'setHighlight' || original.kind === 'clearHighlight' || original.kind === 'createNote' ? original.payload.sentenceIds : [];
  const previousSentences = readerSentences(previous.document);
  const sourceRanges = original.kind === 'setHighlight' || original.kind === 'clearHighlight' || original.kind === 'createNote' ? original.payload.ranges : undefined;
  const sourceQuote = previous.document.revision === original.documentRevision ? sourceRanges ? rangeQuote(sourceRanges, previousSentences) : previousSentences.filter(sentence => sourceIds.includes(sentence.id)).map(sentence => sentence.text).join('\n') : '';
  const [text, setText] = useState(original.kind === 'createNote' || original.kind === 'editNote' ? original.payload.text : '');
  const [ids, setIds] = useState<string[]>(original.kind === 'setHighlight' || original.kind === 'clearHighlight' || original.kind === 'createNote' ? original.payload.sentenceIds.filter(id => sentences.some(sentence => sentence.id === id)) : cloud?.sentenceIds ?? []);
  const [color, setColor] = useState<BulletinReaderHighlightColor>(original.kind === 'setHighlight' ? original.payload.color : 'yellow');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const note = original.kind === 'createNote' || original.kind === 'editNote';
  const anchors = original.kind === 'setHighlight' || original.kind === 'clearHighlight' || note && !cloud;
  const description = {removed_anchor: m.recoveryRemoved, anchor_limit: m.recoveryLimit, color_conflict: m.recoveryColor, note_conflict: m.recoveryNote, mapping_unavailable: m.recoveryMapping, expired_mutation: m.recoveryExpired}[reason];
  return <section className="reader-note-editor" data-reader-selection-tools>
    <p role="status">{description}</p>
    {sourceQuote || cloud?.quote ? <blockquote>{sourceQuote || cloud?.quote}</blockquote> : null}
    {note || original.kind === 'deleteNote' ? <><h3>{m.recoveryCloud}</h3><blockquote>{cloud?.text ?? m.noteDeleted}</blockquote><h3>{m.recoveryLocal}</h3></> : null}
    {note ? <><label>{m.noteText}<textarea value={text} disabled={busy} onChange={event => setText(event.target.value)}/></label><p>{m.noteCount.replace('{count}', String([...text].length))}</p>{cloud ? <button type="button" disabled={busy} onClick={() => setText(`${cloud.text}\n\n${text}`)}>{m.noteManual}</button> : null}</> : null}
    {original.kind === 'deleteNote' ? <p>{m.noteDeleteConfirm}</p> : null}
    {original.kind === 'setHighlight' ? <fieldset><legend>{m.highlightColors}</legend>{(['yellow', 'red', 'blue'] as const).map(option => <label key={option}><input type="radio" name="recovery-color" value={option} checked={color === option} onChange={() => setColor(option)} disabled={busy}/>{m[`${option}Highlight`]}</label>)}</fieldset> : null}
    {anchors && partial ? <fieldset><legend>{m.recoveryRange}</legend><div ref={rangeRoot} className="reader-recovery-anchors reader-recovery-text">{sentences.map(sentence => <p key={sentence.id}><span data-sentence-id={sentence.id} data-fragment-start="0" data-fragment-end={[...sentence.text].length}>{sentence.text}</span></p>)}</div><blockquote>{selection.ranges ? rangeQuote(selection.ranges, sentences) : m.recoveryRange}</blockquote></fieldset> : anchors ? <fieldset><legend>{m.recoveryAnchors}</legend><input type="search" aria-label={m.search} value={search} onChange={event => setSearch(event.target.value)}/><p>{m.recoveryAnchorCount.replace('{count}', String(ids.length))}</p><div className="reader-recovery-anchors">{sentences.filter(sentence => sentence.text.includes(search)).map(sentence => <label key={sentence.id}><input type="checkbox" checked={ids.includes(sentence.id)} disabled={busy || ids.length >= 500 && !ids.includes(sentence.id)} onChange={event => setIds(event.target.checked ? [...ids, sentence.id] : ids.filter(id => id !== sentence.id))}/>{sentence.text}</label>)}</div></fieldset> : null}
    {error ? <p role="alert">{m.actionFailed}</p> : null}
    <div className="reader-note-actions" data-reader-selection-tools><button type="button" disabled={busy} onClick={() => onChoose(null)}>{m.noteCloud}</button><button type="button" disabled={busy || note && (!text.trim() || [...text].length > 10000) || anchors && !(partial ? selection.ids : ids).length || original.kind === 'deleteNote' && !cloud} onClick={() => {
      try {onChoose(manualReaderRecovery(original, prepared.state, prepared.value.document, {sentenceIds: partial ? selection.ids : ids, text, color, ...(partial ? {ranges: selection.ranges} : {})}));}
      catch {setError(true);}
    }}>{m.noteLocal}</button></div>
  </section>;
}
