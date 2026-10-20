import {isBookmarkMutation} from '@/features/weekly-reader/bookmarks';
import {ReaderActionError, type ReaderExclusive} from '@/features/weekly-reader/usePrivateReader';
import {PassageText} from './PassageText';
import {useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {ReaderPrivateState} from './ReaderPrivateState';
import type {BulletinReaderHighlightColor, BulletinReaderMutation, BulletinReaderState, OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {createReaderApi, ReaderSelector} from '@/features/weekly-reader/api';
import {bindOnlinePrivate, chooseReaderRecovery, getOfflineIdentity, readPrivateBinding, supportsOfflineReader} from '@/features/weekly-reader/offline-store';
import {finishReaderUpgrade, prepareReaderUpgrade, type ReaderUpgrade} from '@/features/weekly-reader/upgrade';
import {withReaderWriter} from '@/features/weekly-reader/sync';
import {manualReaderRecovery} from '@/features/weekly-reader/rebase';
import {readerSentences} from '@/features/weekly-reader/selection';
import {rangeQuote, selectionPassage} from '@/features/weekly-reader/text-range';
import {useReaderSelection} from '@/features/weekly-reader/useReaderSelection';
import type {ReaderMessages} from './ReaderToolbar';

export function ReaderRecovery({api, value, selector, messages: m, onUpdated, onFailure, drafts, onDraftsChange, suspended = false, pendingMutation = null, onPendingChange, mobile = false, runExclusive, available = true, onState, inline = false, onOpenChange, onConfirm, onBookmarkRetry, headerRef, closeRef, theme = 'light'}: {
  drafts: Record<string, string>; onDraftsChange: (drafts: Record<string, string>) => void;
  closeRef?: RefObject<(() => boolean) | null>; headerRef?: RefObject<HTMLElement | null>; theme?: 'light' | 'dark';
  onConfirm?: (description: string) => Promise<boolean>;
  onBookmarkRetry?: () => Promise<import('@/features/weekly-reader/usePrivateReader').ReaderOutcome | undefined>;
  api: ReturnType<typeof createReaderApi>; value: OnlineBulletinAccess; selector: ReaderSelector; messages: ReaderMessages;
  onUpdated: (value: OnlineBulletinAccess) => void; onFailure: (error: unknown) => void; suspended?: boolean;
  pendingMutation?: BulletinReaderMutation | null; onPendingChange?: (mutation: BulletinReaderMutation | null, result?: import('@/features/weekly-reader/usePrivateReader').ReaderOutcome, previous?: BulletinReaderMutation | null) => BulletinReaderMutation | null | void;
  mobile?: boolean; runExclusive?: ReaderExclusive; available?: boolean; onState?: (state: BulletinReaderState) => void; inline?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  function changeOpen(next: boolean) {setOpen(next); onOpenChange?.(next);}
  const [prepared, setPrepared] = useState<ReaderUpgrade | null>(null);
  const [deciding, setDeciding] = useState(false);
  useImperativeHandle(closeRef, () => () => {
    if (busy || deciding || suspended) return false;
    changeOpen(false); return true;
  });
  const decisionPending = useRef(false);
  const current = useRef({prepared, suspended, open, selector, mounted: false});
  useLayoutEffect(() => {current.current = {prepared, suspended, open, selector, mounted: true};});
  useLayoutEffect(() => () => {current.current.mounted = false;}, []);
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
    try {await (runExclusive ? runExclusive(work, request.signal) : work(request.signal));}
    catch (failure) {if (!request.signal.aborted) {setError(true); if (!(failure instanceof ReaderActionError)) onFailure(failure);}}
    finally {request.abort(); setBusy(false);}
  }
  async function prepare(signal: AbortSignal) {
    const local = supportsOfflineReader() ? await readPrivateBinding(selector).catch(() => null) : null;
    if (local && !pending.current) {
      const owner = await getOfflineIdentity();
      if (owner.accountId !== selector.accountId || owner.epoch !== local.epoch) throw new Error('offline_account_changed');
      epoch.current = owner.epoch;
      let next: ReaderUpgrade;
      if (local.onlineOnly && local.revision !== value.document.revision) {
        const current = await api.current(selector, value, crypto.randomUUID(), signal);
        signal.throwIfAborted();
        await bindOnlinePrivate(selector, current, owner.epoch);
        const cloud = await api.privateState(selector, current, signal);
        const latest = await readPrivateBinding(selector);
        signal.throwIfAborted();
        next = {onlineOnly: true, value: current, previousRevision: latest.revision, state: cloud.state, queue: latest.replica?.queue ?? [], mutations: [],
          recovery: (latest.replica?.queue ?? []).filter(entry => !entry.resolution || entry.resolution.result && entry.resolution.result.status !== 'applied').map(entry => ({mutationId: entry.mutation.mutationId, reason: 'mapping_unavailable' as const}))};
      } else next = await prepareReaderUpgrade(api, selector, value, owner.epoch, signal);
      signal.throwIfAborted(); onState?.(next.state); setPrepared(next); setAwaitingConfirmation(false);
    } else {
      epoch.current = null;
      const current = await api.current(selector, value, crypto.randomUUID(), signal);
      const cloud = await api.privateState(selector, current, signal);
      signal.throwIfAborted();
      onState?.(cloud.state);
      const mutation = pending.current;
      const expired = mutation && new Date().getTime() - Date.parse(mutation.createdAt) > 90 * 86400000;
      const reviewed = mutation && acknowledged.current?.mutationId === mutation.mutationId;
      setAwaitingConfirmation(Boolean(mutation && !reviewed && !expired));
      setPrepared({value: current, state: cloud.state, queue: mutation ? [{mutation, sent: true}] : [], mutations: [],
        recovery: mutation && (reviewed || expired) ? [{mutationId: mutation.mutationId, reason: expired ? 'expired_mutation' : acknowledged.current?.status === 'note_conflict' ? 'note_conflict' : 'mapping_unavailable'}] : [], previousRevision: value.document.revision});
    }
  }
  function remember(mutation: BulletinReaderMutation | null, result?: import('@/features/weekly-reader/usePrivateReader').ReaderOutcome) {
    const previous = pending.current; pending.current = mutation; acknowledged.current = null; const remaining = onPendingChange?.(mutation, result, previous); if (remaining !== undefined) pending.current = remaining;
  }
  async function retryPending(signal: AbortSignal) {
    if (!prepared || !pending.current) return;
    const mutation = pending.current;
    const response = await withReaderWriter(selector.accountId, signal, () => api.mutate(selector, prepared.value, [mutation], signal));
    signal.throwIfAborted();
    onState?.(response.state);
    if (response.results[0].status === 'applied') remember(null, response.results[0]);
    else acknowledged.current = response.results[0];
    await prepare(signal);
  }
  async function retryBookmark() {
    if (!onBookmarkRetry || busy || !pending.current || !isBookmarkMutation(pending.current)) return;
    setBusy(true); setError(false);
    try {
      const result = await onBookmarkRetry();
      if (!current.current.mounted || !current.current.open || !result) return;
      if (result.status === 'applied') remember(null, result);
      else if ('mutationId' in result) acknowledged.current = result;
      setBusy(false); await run(prepare);
    } catch {if (current.current.mounted) setError(true);}
    finally {if (current.current.mounted) setBusy(false);}
  }
  async function choose(originalId: string | null, mutation: BulletinReaderMutation | null, signal: AbortSignal) {
    if (!prepared) return;
    const accepted = () => {
      if (originalId === null) return;
      const remaining = {...drafts}; delete remaining[originalId]; onDraftsChange(remaining);
    };
    if (epoch.current !== null) {await chooseReaderRecovery(selector, originalId, mutation, epoch.current, prepared.queue); accepted();}
    else {
      // Resolving a server-identified color conflict must not replace the user's
      // pending note/highlight. A consumed conflict ID cannot recolor it again.
      if (originalId === null && pending.current && mutation?.kind === 'resolveHighlightMigrationConflict') {
        const response = await withReaderWriter(selector.accountId, signal, () => api.mutate(selector, prepared.value, [mutation], signal));
        signal.throwIfAborted();
        onState?.(response.state);
        if (response.results[0].status !== 'applied') throw new Error('action_required');
        await prepare(signal); return;
      }
      remember(mutation); accepted();
      if (mutation) {await retryPending(signal); return;}
    }
    await prepare(signal);
  }
  const conflict = prepared?.state.conflicts[0];
  const partialConflict = conflict?.sources.some(source => source.segments?.length);
  const recovery = prepared?.recovery[0];
  const entry = prepared?.queue.find(entry => entry.mutation.mutationId === recovery?.mutationId);
  async function chooseColor(color: BulletinReaderHighlightColor) {
    if (!prepared || !conflict || busy || suspended || decisionPending.current) return;
    const snapshot = prepared;
    decisionPending.current = true; setDeciding(true);
    try {
      if (partialConflict && !await onConfirm?.(m.recoveryPartialColor)) return;
      const latest = current.current;
      if (!latest.mounted || latest.suspended || !latest.open || latest.prepared !== snapshot || JSON.stringify(latest.selector) !== JSON.stringify(selector) || controller.current && !controller.current.signal.aborted) return;
      await run(signal => choose(null, {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: snapshot.value.document.revision, kind: 'resolveHighlightMigrationConflict', payload: {conflictId: conflict.id, chosenColor: color, currentRevision: snapshot.value.document.revision}}, signal));
    } catch {if (current.current.mounted) setError(true);}
    finally {decisionPending.current = false; if (current.current.mounted) setDeciding(false);}
  }
  const content = <div className="reader-private-sheet reader-recovery" hidden={suspended} inert={suspended}>
      <p>{m.recoveryHelp}</p>
      {busy ? <p role="status">{m.syncSyncing}</p> : null}
      {error ? <p role="alert">{m.actionFailed}</p> : null}
      {awaitingConfirmation ? <section><p>{m.confirmRetryHelp}</p>{pendingMutation && isBookmarkMutation(pendingMutation) ? prepared && prepared.value.document.revision !== value.document.revision ? <button type="button" disabled={busy || deciding} onClick={() => {onUpdated(prepared.value); changeOpen(false);}}>{m.applyUpdate}</button> : <button type="button" disabled={busy || deciding || !onBookmarkRetry} onClick={() => {void retryBookmark();}}>{m.confirmRetry}</button> : <button type="button" disabled={busy || deciding} onClick={() => void run(retryPending)}>{m.confirmRetry}</button>}</section> : conflict && prepared ? <section>
        <p>{partialConflict ? m.recoveryPartialColor : m.recoveryColor}</p>
        {partialConflict ? <><h3>{m.recoveryCurrentText}</h3><blockquote>{readerSentences(prepared.value.document).filter(sentence => conflict.sentenceIds.includes(sentence.id)).map(sentence => sentence.text).join('\n')}</blockquote></> : null}
        {conflict.sources.map(source => <blockquote key={`${source.sentenceId}:${source.color}`}>
          {source.segments?.length ? source.segments.map(part => <span key={`${part.start}:${part.end}`} className="reader-conflict-fragment" data-color={part.color}>{[...source.quote].slice(part.start, part.end).join('')}</span>) : <><span className="reader-color"><span data-color={source.color}/></span>{source.quote}</>}
        </blockquote>)}
        <div className="reader-note-actions">{(['yellow', 'red', 'blue'] as const).map(color => <button key={color} className="reader-color" aria-label={m[`${color}Highlight`]} disabled={busy || deciding} onClick={() => {void chooseColor(color);}}><span data-color={color}/></button>)}</div></section> :
        recovery && entry && prepared ? <RecoveryChoice key={`${recovery.mutationId}:${entry.resolution?.mutation?.mutationId ?? ''}:${prepared.state.notes.map(note => note.version).join(',')}`} draftText={drafts[entry.mutation.mutationId]} onTextChange={text => {
          const original = entry.resolution?.mutation ?? entry.mutation;
          const next = {...drafts};
          if ((original.kind === 'createNote' || original.kind === 'editNote') && text === original.payload.text) delete next[entry.mutation.mutationId];
          else next[entry.mutation.mutationId] = text;
          onDraftsChange(next);
        }} prepared={prepared} previous={value} original={entry.resolution?.mutation ?? entry.mutation} reason={recovery.reason} messages={m} busy={busy} mobile={mobile} onChoose={mutation => void run(signal => choose(entry.mutation.mutationId, mutation, signal))}/> :
        prepared ? <button type="button" disabled={busy || deciding} onClick={() => void run(async signal => {
          const finished = epoch.current === null ? {value: prepared.value, state: prepared.state} : await finishReaderUpgrade(api, selector, prepared, epoch.current, signal);
          signal.throwIfAborted(); if (epoch.current !== null) onState?.(finished.state); onUpdated(finished.value); changeOpen(false);
        })}>{m.applyUpdate}</button> : null}
      {error ? <button type="button" disabled={busy || deciding} onClick={() => void run(prepare)}>{m.retry}</button> : null}
      <button type="button" disabled={busy || deciding} onClick={() => changeOpen(false)}>{m.keepReading}</button>
    </div>;
  return <>
    {available || open ? <button type="button" disabled={busy || deciding} onClick={() => {changeOpen(true); setPrepared(null); void run(prepare);}}>{m.reviewSync}</button> : null}
    {inline ? open ? content : null : <ReaderPrivateState isOpen={open} wide={false} headerRef={headerRef} title={m.reviewSync} theme={theme} messages={m} suspended={suspended} onClose={() => {if (!busy && !deciding && !suspended) changeOpen(false);}}>{open ? content : null}</ReaderPrivateState>}
  </>;
}

function RecoveryChoice({prepared, previous, original, reason, messages: m, busy, onChoose, mobile, draftText, onTextChange: setText}: {
  draftText?: string; onTextChange: (text: string) => void;
  prepared: ReaderUpgrade; previous: OnlineBulletinAccess; original: BulletinReaderMutation; reason: ReaderUpgrade['recovery'][number]['reason']; messages: ReaderMessages; busy: boolean; mobile: boolean; onChoose: (mutation: BulletinReaderMutation | null) => void;
}) {
  const sentences = useMemo(() => readerSentences(prepared.value.document), [prepared.value.document]);
  const rangeRoot = useRef<HTMLDivElement>(null);
  const partial = 'ranges' in original.payload;
  const {selection} = useReaderSelection(rangeRoot, sentences, {ids: []}, !partial || busy, mobile ? 'clause' : 'text');
  const {ranges, quote: selectedQuote} = selectionPassage(selection, sentences);
  const cloud = original.kind === 'createNote' || original.kind === 'editNote' || original.kind === 'deleteNote' || original.kind === 'reanchorNote' ? prepared.state.notes.find(note => note.id === original.payload.noteId && !note.deleted) : undefined;
  const sourceIds = original.kind === 'setHighlight' || original.kind === 'clearHighlight' || original.kind === 'createNote' ? original.payload.sentenceIds : [];
  const previousSentences = readerSentences(previous.document);
  const sourceRanges = original.kind === 'setHighlight' || original.kind === 'clearHighlight' || original.kind === 'createNote' ? original.payload.ranges : undefined;
  const historical = original.kind === 'restoreHighlight' || original.kind === 'discardHighlightHistory' ? prepared.state.highlightHistory?.find(entry => entry.id === original.payload.historyId)?.highlight : undefined;
  const sourceQuote = historical ? historical.segments?.length ? historical.segments.map(part => [...historical.quote].slice(part.start, part.end).join('')).join(' … ') : historical.quote : previous.document.revision === original.documentRevision ? sourceRanges ? rangeQuote(sourceRanges, previousSentences) : previousSentences.filter(sentence => sourceIds.includes(sentence.id)).map(sentence => sentence.text).join('\n') : '';
  const text = draftText ?? (original.kind === 'createNote' || original.kind === 'editNote' ? original.payload.text : '');
  const [ids, setIds] = useState<string[]>(original.kind === 'setHighlight' || original.kind === 'clearHighlight' || original.kind === 'createNote' ? original.payload.sentenceIds.filter(id => sentences.some(sentence => sentence.id === id)) : cloud?.sentenceIds ?? []);
  const [color, setColor] = useState<BulletinReaderHighlightColor>(original.kind === 'setHighlight' || original.kind === 'restoreHighlight' ? original.payload.color : 'yellow');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const note = original.kind === 'createNote' || original.kind === 'editNote';
  const anchors = original.kind === 'setHighlight' || original.kind === 'restoreHighlight' || original.kind === 'clearHighlight' || original.kind === 'reanchorNote' || note && !cloud;
  if (isBookmarkMutation(original)) return <section className="reader-note-editor"><p>{m.bookmarkRebindHelp}</p><h3>{m.recoveryLocal}</h3><p className="reader-note-text">{original.kind === 'createBookmark' || original.kind === 'renameBookmark' ? original.payload.name : m.bookmarksTab}</p><h3>{m.recoveryCloud}</h3><p className="reader-note-text">{prepared.state.bookmarks?.find(bookmark => bookmark.id === original.payload.bookmarkId && !bookmark.deleted)?.name ?? m.bookmarkDeleted}</p><button type="button" disabled={busy} onClick={() => onChoose(null)}>{m.noteCloud}</button></section>;
  const description = {removed_anchor: m.recoveryRemoved, anchor_limit: m.recoveryLimit, color_conflict: m.recoveryColor, note_conflict: m.recoveryNote, mapping_unavailable: m.recoveryMapping, expired_mutation: m.recoveryExpired}[reason];
  return <section className="reader-note-editor" data-reader-selection-tools>
    <p role="status">{description}</p>
    {sourceQuote || cloud?.quote ? <blockquote>{sourceQuote || cloud?.quote}</blockquote> : null}
    {note || original.kind === 'deleteNote' ? <><h3>{m.recoveryCloud}</h3><blockquote>{cloud?.text ?? m.noteDeleted}</blockquote><h3>{m.recoveryLocal}</h3></> : null}
    {note ? <><label>{m.noteText}<textarea value={text} disabled={busy} onChange={event => setText(event.target.value)}/></label><p>{m.noteCount.replace('{count}', String([...text].length))}</p>{cloud ? <button type="button" disabled={busy} onClick={() => setText(`${cloud.text}\n\n${text}`)}>{m.noteManual}</button> : null}</> : null}
    {original.kind === 'deleteNote' ? <p>{m.noteDeleteConfirm}</p> : null}
    {original.kind === 'setHighlight' || original.kind === 'restoreHighlight' ? <fieldset><legend>{m.highlightColors}</legend>{(['yellow', 'red', 'blue'] as const).map(option => <label key={option}><input type="radio" name="recovery-color" value={option} checked={color === option} onChange={() => setColor(option)} disabled={busy}/>{m[`${option}Highlight`]}</label>)}</fieldset> : null}
    {anchors && partial ? <fieldset aria-description={mobile ? m.clauseKeyboardHelp : undefined}><legend>{m.recoveryRange}</legend><PassageText root={rangeRoot} sentences={sentences} selection={selection} mobile={mobile}/><blockquote aria-live="polite">{selectedQuote || m.recoveryRange}</blockquote></fieldset> : anchors ? <fieldset><legend>{m.recoveryAnchors}</legend><input type="search" aria-label={m.search} value={search} onChange={event => setSearch(event.target.value)}/><p>{m.recoveryAnchorCount.replace('{count}', String(ids.length))}</p><div className="reader-recovery-anchors">{sentences.filter(sentence => sentence.text.includes(search)).map(sentence => <label key={sentence.id}><input type="checkbox" checked={ids.includes(sentence.id)} disabled={busy || ids.length >= 500 && !ids.includes(sentence.id)} onChange={event => setIds(event.target.checked ? [...ids, sentence.id] : ids.filter(id => id !== sentence.id))}/>{sentence.text}</label>)}</div></fieldset> : null}
    {error ? <p role="alert">{m.actionFailed}</p> : null}
    <div className="reader-note-actions" data-reader-selection-tools><button type="button" disabled={busy} onClick={() => onChoose(null)}>{m.noteCloud}</button><button type="button" disabled={busy || note && (!text.trim() || [...text].length > 10000) || anchors && !(partial ? selectedQuote : ids.length) || original.kind === 'deleteNote' && !cloud} onClick={() => {
      try {onChoose(manualReaderRecovery(original, prepared.state, prepared.value.document, {sentenceIds: partial ? selection.ids : ids, text, color, ...(partial ? {ranges} : {})}));}
      catch {setError(true);}
    }}>{m.noteLocal}</button></div>
  </section>;
}
