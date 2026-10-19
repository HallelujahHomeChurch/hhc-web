'use client';

import {useCallback, useEffect, useEffectEvent, useLayoutEffect, useSyncExternalStore, useMemo, useRef, useState, type ReactNode} from 'react';
import {NotebookPen, Search, ALargeSmall, ArrowUp, ArrowDown, X, ChevronsUpDown, ChevronsLeftRight, ChevronLeft, ChevronRight, PanelLeft, Moon, Sun} from 'lucide-react';
import {useScrollChrome} from '@/components/layout/useScrollChrome';
import {isIPhoneDevice, isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {ReaderTypography, readTypography, type Typography} from './ReaderTypography';
import {useReaderTheme} from './useReaderTheme';
import {AlertDialog, Dialog, BulletinEbook, bulletinChapters, bulletinChapterForAnchor, bulletinMobileDetails, Button, ReaderWatermark} from '@hallelujahhomechurch/ui';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import type {OnlineBulletinAccess, BulletinReaderMutation, BulletinReaderNote, BulletinReaderBookmark} from '@hallelujahhomechurch/hhc-web-client';
import type {BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';
import {useAccountAuth, useAccountIdentity, useAccountSignIn, useBulletinAccess, useBulletinAuthorization} from '@/components/layout/AccountControl';
import {createReaderApi, verifyReaderAccess, type ReaderSelector} from '@/features/weekly-reader/api';
import {keyboardPageDelta, pageScale, sourcePageStart, sourcePageForSentence, swipeDirection, visibleReadingAnchor, resolveReadingAnchor, type ReadingAnchor, type ReaderZoom} from '@/features/weekly-reader/navigation';
import {fitPaperLines} from '@/features/weekly-reader/paper-lines';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';
import {getOfflineIdentity, supportsOfflineReader} from '@/features/weekly-reader/offline-store';
import {watchOfflineAccount} from '@/features/weekly-reader/offline-session';
import {useReaderSession} from '@/features/weekly-reader/useReaderSession';
import {useReaderSearchNavigation} from '@/features/weekly-reader/useReaderSearchNavigation';
import {ReaderActionError, usePrivateReader, type ReaderOutcome} from '@/features/weekly-reader/usePrivateReader';
import {exactBookmarkTarget, isBookmarkMutation, type BookmarkTarget} from '@/features/weekly-reader/bookmarks';
import {readerSentences} from '@/features/weekly-reader/selection';
import {rangeQuote, renderedTextRanges, type ReaderTextRange} from '@/features/weekly-reader/text-range';
import {selectedHighlight} from '@/features/weekly-reader/highlight-selection';
import {useReaderSelection} from '@/features/weekly-reader/useReaderSelection';
import {copySentences, copyTextRanges} from '@/features/weekly-reader/copy';
import {RangeHighlights} from './RangeHighlights';
import {flushReaderProgressBeforeExit, useReaderProgress} from '@/features/weekly-reader/progress';
import {useReaderExitGuard} from '@/features/weekly-reader/useReaderExitGuard';
import {NoteIndicators} from './NoteIndicators';
import {readReaderReturn, saveReaderReturn} from '@/features/weekly-reader/return-state';
import type {Locale} from '@/i18n/locales';
import {ReaderToolbar, type ReaderMessages} from './ReaderToolbar';
import {PageNavigator} from './PageNavigator';
import {ReaderTabs} from './ReaderTabs';
import {PaperViewport, type ReadingDirection} from './PaperViewport';
import {usePaperGestures} from '@/features/weekly-reader/usePaperGestures';
import {readPaperView, writePaperView, readReadingMode, writeReadingMode, type ReadingMode} from '@/features/weekly-reader/workspace';
import {SectionNavigator} from './SectionNavigator';
import {ReaderSearch} from './ReaderSearch';
import {ReaderLoading} from './ReaderLoading';
import {OfflineControl} from './OfflineControl';
import {SelectionToolbar} from './SelectionToolbar';
import {NoteEditor, type NoteSave, type NoteEditorState} from './NoteEditor';
import {NoteReanchor} from './NoteReanchor';
import type {BookmarkDraft} from './BookmarksPanel';
import {ReaderNotesList} from './ReaderNotesList';
import {NoteExportDialog} from './NoteExportDialog';
import {ReaderPrivateState, SyncStatus} from './ReaderPrivateState';
import {ReaderRecovery} from './ReaderRecovery';
import '@hallelujahhomechurch/ui/bulletin-paper.css';
import '@hallelujahhomechurch/ui/bulletin-paper-v2.css';
import '@hallelujahhomechurch/ui/bulletin-paper-v7.css';
import '@hallelujahhomechurch/ui/bulletin-ebook.css';
import './reader.css';

type Props = {locale: Locale; issueNumber: number; series: BulletinSeries; contentLocale: BulletinLocale; messages: ReaderMessages};
const subscribeStandalone = () => () => undefined;
const iphoneStandaloneSnapshot = () => isIPhoneDevice() && isStandaloneWebApp();
const serverStandaloneSnapshot = () => false;
type Anchor = {kind: 'component' | 'sentence'; id: string; start?: number};
export function WeeklyReader(props: Props) {
  const readerTheme = useReaderTheme();
  const accountId = useAccountIdentity();
  const auth = useAccountAuth();
  const signIn = useAccountSignIn();
  const access = useBulletinAccess();
  const m = props.messages;
  const enabled = isWeeklyReaderEnabled();
  const [offlineAccount, setOfflineAccount] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !supportsOfflineReader()) return;
    let active = true;
    void getOfflineIdentity().then(owner => {if (active) setOfflineAccount(owner.accountId);}).catch(() => {});
    const stop = watchOfflineAccount(setOfflineAccount);
    return () => {active = false; stop();};
  }, [enabled]);
  const savedAccount = enabled ? accountId ?? offlineAccount : null;
  const permitted = enabled && accountId && access.status === 'available' && access.editions.some(edition => edition.series === props.series && edition.locale === props.contentLocale);
  const checking = enabled && (auth.status === 'checking' || access.status === 'loading');
  return <main className="weekly-reader" data-theme={readerTheme.theme} style={{colorScheme: readerTheme.theme}}>
    {!checking && !permitted && !(savedAccount && offlineAccount === savedAccount) ? <a className="reader-back" href={`/${props.locale}/literature-ministry`}>{m.back}</a> : null}
    {permitted || savedAccount && offlineAccount === savedAccount ? <AuthorizedReader key={`${savedAccount}:${props.issueNumber}:${props.series}:${props.contentLocale}`} {...props} accountId={savedAccount!} readerTheme={readerTheme}/> :
      checking ? <ReaderLoading label={m.loading} showHeader/> : <section className="reader-status" role="status"><h1>{m.title}</h1><p>{!enabled ? m.unavailable : auth.status === 'anonymous' ? m.signInRequired : m.unavailable}</p>{enabled && auth.status === 'anonymous' ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}</section>}
  </main>;
}

function AuthorizedReader(props: Props & {accountId: string; readerTheme: ReturnType<typeof useReaderTheme>}) {
  const signIn = useAccountSignIn();
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createReaderApi(authorization), [authorization]);
  const m = props.messages;
  const {accountId, issueNumber, series, contentLocale} = props;
  const selector = {accountId, issueNumber, series, contentLocale};
  const session = useReaderSession(api, selector);
  const guard = (event: React.SyntheticEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-reader-exit]')) return;
    if (!session.allowAction()) {event.preventDefault(); event.stopPropagation();}
  };
  if (session.value) return <>
    <div onClickCapture={guard} onKeyDownCapture={guard} onPointerDownCapture={guard} onCopyCapture={guard}>
    {session.offline ? <p role="status">{m.offlineNotice}</p> : null}
    {session.loginRequired ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}
    <ReaderDocument readerTheme={props.readerTheme} key={`${session.value.document.documentId}:${session.value.document.revision}`} value={session.value} selector={selector} messages={m} api={api} offline={session.offline} allowAction={session.allowAction} onFailure={session.privateFailure} onUpdated={session.acceptSaved} suspended={false} backHref={`/${props.locale}/literature-ministry`} offlineControl={<OfflineControl api={api} value={session.value} selector={selector} locale={props.locale} messages={m} onSaved={session.acceptSaved} onFailure={session.privateFailure}/>}/>
  </div></>;
  return <ReaderSessionStatus props={props} session={session} signIn={signIn}/>;
}

function ReaderExitDialog({exit, theme}: {exit: ReturnType<typeof useReaderExitGuard>; theme: 'light' | 'dark'}) {
  const dialog = exit.dialogProps;
  return <Dialog title={dialog.title} isOpen={dialog.isOpen} closeLabel={dialog.closeLabel} onOpenChange={dialog.onOpenChange}>
    <p ref={node => {
    const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay');
    if (overlay) {overlay.dataset.readerExit = ''; overlay.dataset.theme = theme; overlay.style.colorScheme = theme;}
  }}>{dialog.description}</p>
    <div className="hhc-dialog__actions">
      <Button variant="secondary" onPress={() => dialog.onOpenChange?.(false)}>{dialog.cancelLabel}</Button>
      <Button variant="primary" isDisabled={exit.confirming} onPress={() => {void dialog.onConfirm();}}>{dialog.confirmLabel}</Button>
    </div>
  </Dialog>;
}

function ReaderSessionStatus({props, session, signIn}: {props: Props & {accountId: string; readerTheme: ReturnType<typeof useReaderTheme>}; session: ReturnType<typeof useReaderSession>; signIn: ReturnType<typeof useAccountSignIn>}) {
  const m = props.messages;
  const exit = useReaderExitGuard({hasUnsavedNote: () => false, beforeLeave: async () => true, messages: m});
  return <><ReaderTabs accountId={props.accountId} locale={props.locale} current={props} messages={m} beforeLeave={() => exit.confirmLeave('home')}/>{session.error ? <section className="reader-status" role="alert"><h1>{m.title}</h1><p>{m[session.error]}</p>{session.loginRequired ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}<button type="button" onClick={session.retry}>{m.retry}</button></section> : <ReaderLoading label={m.loading}/>}<ReaderExitDialog exit={exit} theme={props.readerTheme.theme}/></>;
}

function ReaderDocument({value, selector, messages: m, api, offline, allowAction, onFailure, onUpdated, suspended, backHref, offlineControl, readerTheme}: {readerTheme: ReturnType<typeof useReaderTheme>; value: OnlineBulletinAccess; selector: ReaderSelector; messages: ReaderMessages; api: ReturnType<typeof createReaderApi>; offline: boolean; allowAction: () => boolean; onFailure: (error: unknown) => void; onUpdated: (value: OnlineBulletinAccess) => void; suspended: boolean; backHref: string; offlineControl: ReactNode}) {
  const {theme, toggle: toggleTheme} = readerTheme;
  const [returned] = useState(() => readReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}));
  const document = useMemo(() => verifyReaderAccess(value, selector), [value, selector]);
  const privateReader = usePrivateReader({api, selector, value, offline, allowAction, onFailure});
  const progress = useReaderProgress(value.document, privateReader.mutate);
  const recordProgress = progress.record;
  const flushProgress = progress.flush;
  const sentences = useMemo(() => readerSentences(value.document), [value.document]);
  const [notice, setNotice] = useState('');
  const [notes, setNotesState] = useState<'list' | 'new' | 'restore' | BulletinReaderNote | null>(returned?.draft ? returned.draft.noteId ? 'restore' : 'new' : returned?.action && isBookmarkMutation(returned.action) ? 'list' : null);
  const [noteFilter, setNoteFilter] = useState<string[] | null>(null);
  const [exportRequest, setExportRequest] = useState<{ids: string[]; generation: number} | null>(null);
  const storageKey = `weekly-reader-position:${selector.accountId}:${value.document.documentId}:${value.document.revision}`;
  const paperRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [readingMode, setReadingMode] = useState<ReadingMode | null>(() => readReadingMode(storageKey));
  const reflow = readingMode ? readingMode === 'easy' : mobile;
  const currentReflow = useRef(reflow);
  useLayoutEffect(() => {currentReflow.current = reflow;}, [reflow]);
  const modeRequest = useRef(0);
  const modeAnchor = useRef<ReadingAnchor | null>(null);
  const suppressModeProgress = useRef(false);
  const {selection, selecting, setSelection, clear: clearSelection, clearIf} = useReaderSelection(paperRef, sentences, {
    ids: returned?.revision === value.document.revision ? returned.selected.filter(id => sentences.some(sentence => sentence.id === id)) : [],
    ranges: returned?.revision === value.document.revision ? returned.selectedRanges : undefined
  }, !!notes || suspended, mobile ? 'sentence' : 'text');
  const selected = selection.ids;
  const selectionRanges = useMemo(() => selection.ranges ?? sentences.filter(sentence => selected.includes(sentence.id)).map(sentence => ({sentenceId: sentence.id, start: 0, end: [...sentence.text].length})), [selection.ranges, selected, sentences]);
  const savedHighlights = useMemo(() => privateReader.state?.highlights ?? [], [privateReader.state?.highlights]);
  const highlightSelection = selectedHighlight(selectionRanges, savedHighlights);
  const selectExisting = useCallback((range: ReaderTextRange) => {
    if (allowAction() && !notes && !suspended) setSelection({ids: [range.sentenceId], ranges: [range]});
  }, [allowAction, notes, suspended, setSelection]);
  const [noteEditorState, setEditorState] = useState<NoteEditorState | undefined>(returned?.draft ? {draft: returned.draft, conflict: null} : undefined);
  const generation = useRef(0);
  const [bookmarkDraft, setBookmarkDraftState] = useState<BookmarkDraft | null>(() => {
    const action = returned?.action;
    if (!action || !isBookmarkMutation(action)) return null;
    return {kind: action.kind === 'createBookmark' ? 'create' : action.kind === 'renameBookmark' ? 'rename' : action.kind === 'deleteBookmark' ? 'delete' : 'reanchor', id: action.payload.bookmarkId, name: action.kind === 'createBookmark' || action.kind === 'renameBookmark' ? action.payload.name : m.bookmarkDefault, originalName: '', baseVersion: action.baseVersion,
      target: (action.kind === 'createBookmark' || action.kind === 'reanchorBookmark') && action.documentRevision === value.document.revision ? {sentenceId: action.payload.sentenceId, offset: action.payload.offset, pageId: action.payload.pageId} : null};
  });
  const bookmarkDraftRef = useRef(bookmarkDraft), bookmarkPosition = useRef<BookmarkTarget | null>(null);
  function setBookmarkDraft(next: BookmarkDraft | null) {if (JSON.stringify(next) !== JSON.stringify(bookmarkDraftRef.current)) generation.current++; bookmarkDraftRef.current = next; setBookmarkDraftState(next);}
  const bookmarkOperation = useRef<{mutation: BulletinReaderMutation; generation: number} | null>(returned?.action && isBookmarkMutation(returned.action) ? {mutation: returned.action, generation: 0} : null);

  function setNotes(next: typeof notes) {generation.current++; setNotesState(next);}
  const editorDraft = useRef(noteEditorState?.draft);
  function setNoteEditorState(next: NoteEditorState | undefined) {
    if (JSON.stringify(editorDraft.current) !== JSON.stringify(next?.draft)) generation.current++;
    editorDraft.current = next?.draft; setEditorState(next);
  }
  const noteOperation = useRef<{mutation: BulletinReaderMutation; generation: number; local?: BulletinReaderNote} | null>(returned?.action ? {mutation: returned.action, generation: 0} : null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryControl = useRef<HTMLDivElement>(null);
  const operationRef = useRef(privateReader.operation);
  useEffect(() => {operationRef.current = privateReader.operation;}, [privateReader.operation]);
  const foregroundBusy = ['waiting', 'confirming', 'sending'].includes(privateReader.operation);
  function openRecovery() {recoveryControl.current?.querySelector<HTMLButtonElement>('button')?.click();}
  function actionError(error: unknown) {
    if (error instanceof ReaderActionError) {
      setNotice(error.reason === 'timeout' ? m.operationTimeout : error.reason === 'busy' ? m.operationSending : '');
    } else setNotice(m.actionFailed);
  }
  useEffect(() => {
    if (!notice || notice !== m.syncSynced && notice !== m.copySuccess) return;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice, m.syncSynced, m.copySuccess]);
  function settleNote(mutation: BulletinReaderMutation, result: ReaderOutcome) {
    const operation = noteOperation.current;
    const owns = operation?.mutation.mutationId === mutation.mutationId && operation.generation === generation.current;
    if (result.status === 'applied') {setNotice(''); return;}
    if (result.status === 'queued') {
      setNotice('');
      if (!owns) return;
      if (mutation.kind === 'createNote' || mutation.kind === 'editNote') {
        finishNoteEditor(); if (mutation.kind === 'createNote') clearSelection();
        requestAnimationFrame(() => notesButton.current?.focus());
      } else if (mutation.kind === 'deleteNote') {setDeletion(null); setNotes('list'); if (operation) operation.generation = generation.current;}
      else if (mutation.kind === 'reanchorNote') setReanchor(null);
    } else if (result.status === 'note_conflict') {
      setNotice('');
      if (!owns) return;
      if (mutation.kind === 'deleteNote' && operation.local) setDeletion({local: operation.local, cloud: result.note, durable: result.durable, mutationId: mutation.mutationId});
      else if ((mutation.kind === 'createNote' || mutation.kind === 'editNote') && noteEditorState) setNoteEditorState({...noteEditorState, conflict: {status: 'note_conflict', note: result.note, durable: result.durable}});
      else if (mutation.kind === 'reanchorNote') setReanchorConflict({status: 'note_conflict', note: result.note, durable: result.durable});
    } else setNotice(m.syncAction);
  }
  const receiveMutationOutcome = useEffectEvent((outcome: NonNullable<typeof privateReader.mutationOutcome>) => {
    if (allowAction()) settleNote(outcome.mutation, outcome.result);
  });
  useEffect(() => {
    const outcome = privateReader.mutationOutcome; let active = true;
    if (outcome) queueMicrotask(() => {if (active) receiveMutationOutcome(outcome);});
    return () => {active = false;};
  }, [privateReader.mutationOutcome]);
  const [deletion, setDeletion] = useState<{local: BulletinReaderNote; cloud?: BulletinReaderNote; durable?: boolean; mutationId: string} | null>(null);
  const [reanchor, setReanchorState] = useState<BulletinReaderNote | null>(null);
  const [reanchorConflict, setReanchorConflict] = useState<import('./NoteEditor').NoteSaveResult | null>(null);
  function setReanchor(note: BulletinReaderNote | null) {generation.current++; setReanchorConflict(null); setReanchorState(note);}
  const [wideNotes, setWideNotes] = useState(false);
  const documentRef = useRef<HTMLElement>(null);
  const [decision, setDecision] = useState<{title: string; description: string; confirmLabel: string; cancelLabel: string; text?: string} | null>(null);
  const decisionRequest = useRef<{resolve: (accepted: boolean) => void; generation: number} | null>(null);
  useEffect(() => () => {decisionRequest.current?.resolve(false); decisionRequest.current = null;}, []);
  function confirmReaderAction(description: string, title = m.myNotes, confirmLabel = m.noteDiscard, cancelLabel = m.noteCancel, text?: string) {
    if (decisionRequest.current || exit.dialogProps.isOpen || suspended || !allowAction()) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      decisionRequest.current = {resolve, generation: generation.current}; setDecision({title, description, confirmLabel, cancelLabel, text});
    });
  }
  function confirmNote(kind: 'discard' | 'delete', text?: string) {
    return kind === 'delete' ? confirmReaderAction(m.noteDeleteConfirm, m.noteDelete, m.noteDelete, m.noteCancel, text) : confirmReaderAction(m.noteDiscardConfirm, m.myNotes, m.noteDiscard, m.noteContinueEditing);
  }
  function settleDecision(accepted: boolean) {
    const request = decisionRequest.current; decisionRequest.current = null; setDecision(null);
    request?.resolve(accepted && request.generation === generation.current && !!documentRef.current && allowAction() && !suspended);
  }
  const noteButton = useRef<HTMLButtonElement>(null);
  const notesButton = useRef<HTMLButtonElement>(null);
  const newNoteId = useRef<string | null>(returned?.action?.kind === 'createNote' ? returned.action.payload.noteId : null);
  const highlights = Object.fromEntries(privateReader.state?.highlights.filter(highlight => highlight.active && !highlight.segments).map(highlight => [highlight.sentenceId, highlight.color]) ?? []);
  const sentenceState = Object.fromEntries(sentences.map(sentence => [sentence.id, {highlight: highlights[sentence.id], selected: mobile && selected.includes(sentence.id)}]));
  const editingNote = typeof notes === 'object' && notes ? notes : notes === 'restore' ? privateReader.state?.notes.find(note => note.id === returned?.draft?.noteId) : undefined;
  const noteAnchors = editingNote ? editingNote.sentenceIds : selected;
  const noteQuote = editingNote ? editingNote.quote : selection.ranges ? rangeQuote(selection.ranges, sentences) : sentences.filter(sentence => selected.includes(sentence.id)).map(sentence => sentence.text).join('\n');
  function hasUnsavedNote() {return !!bookmarkDraftRef.current || !!(notes && notes !== 'list' && noteEditorState && noteEditorState.draft.text !== (editingNote?.text ?? ''));}
  function cleanupNotes() {setBookmarkDraft(null); setExportRequest(null); setNotes(null); setDeletion(null); setReanchor(null); setNoteEditorState(undefined);}
  function finishNoteEditor() {
    if (!bookmarkDraftRef.current) {cleanupNotes(); return;}
    setNotes('list'); setDeletion(null); setReanchor(null); setNoteEditorState(undefined);
  }
  function noteSending() {return operationRef.current === 'sending';}
  async function closeNotes() {
    if (noteSending() || recoveryOpen) return false;
    if (hasUnsavedNote() && !await confirmNote('discard')) return false;
    if (!documentRef.current || !allowAction() || noteSending()) return false;
    privateReader.cancelWaiting(); cleanupNotes();
    requestAnimationFrame(() => (noteButton.current ?? notesButton.current)?.focus());
    return true;
  }
  async function openNotesList(ids: string[] | null, trigger?: HTMLButtonElement) {
    if (notes && !await closeNotes()) return;
    noteButton.current = trigger ?? null;
    bookmarkPosition.current = captureBookmarkPosition();
    setNoteFilter(ids); setNotes('list');
  }
  function captureBookmarkPosition() {
    const root = paperRef.current;
    return root && !root.closest('[aria-hidden="true"]') ? exactBookmarkTarget(value.document, visibleReadingAnchor(root, value.document.content, readingInset(), page)) : bookmarkPosition.current;
  }
  function settleBookmark(mutation: BulletinReaderMutation, result: ReaderOutcome) {
    const operation = bookmarkOperation.current;
    if (!operation || operation.mutation.mutationId !== mutation.mutationId || operation.generation !== generation.current) return;
    if (result.status === 'applied') {setBookmarkDraft(null); setNotice('');}
    else if (bookmarkDraftRef.current) setBookmarkDraft({...bookmarkDraftRef.current, error: result.status === 'bookmark_limit' ? m.bookmarkLimit : m.bookmarkConflict, conflict: 'bookmark' in result ? result.bookmark : undefined});
  }
  const receiveBookmarkOutcome = useEffectEvent((result: NonNullable<typeof privateReader.bookmarkOutcome>) => {
    const operation = bookmarkOperation.current;
    if (operation && result.status === 'applied' && allowAction()) settleBookmark(operation.mutation, result);
  });
  useEffect(() => {if (privateReader.bookmarkOutcome) receiveBookmarkOutcome(privateReader.bookmarkOutcome);}, [privateReader.bookmarkOutcome]);
  async function saveBookmark(input = bookmarkDraftRef.current) {
    if (!input || !allowAction() || suspended || privateReader.busy) return;
    if (input.kind === 'delete' && !await confirmReaderAction(m.bookmarkDeleteConfirm, m.bookmarksTab, m.noteDelete)) return;
    if (!documentRef.current || !allowAction() || input !== bookmarkDraftRef.current) return;
    const target = input.target;
    if (input.kind !== 'rename' && input.kind !== 'delete' && (!target || !exactBookmarkTarget(value.document, {kind: 'sentence', id: target.sentenceId, start: target.offset, page: value.document.content.pages.findIndex(page => page.id === target.pageId)}))) {setBookmarkDraft({...input, error: m.bookmarkChoosePosition}); return;}
    const common = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision};
    const mutation: BulletinReaderMutation = input.kind === 'create' ? {...common, kind: 'createBookmark', payload: {bookmarkId: input.id, name: input.name.trim(), ...target!}} : input.kind === 'rename' ? {...common, kind: 'renameBookmark', baseVersion: input.baseVersion!, payload: {bookmarkId: input.id, name: input.name.trim()}} : input.kind === 'delete' ? {...common, kind: 'deleteBookmark', baseVersion: input.baseVersion!, payload: {bookmarkId: input.id}} : {...common, kind: 'reanchorBookmark', baseVersion: input.baseVersion!, payload: {bookmarkId: input.id, ...target!}};
    bookmarkOperation.current = {mutation, generation: generation.current};
    try {settleBookmark(mutation, await privateReader.mutate(mutation));} catch (error) {actionError(error);}
  }
  async function saveNote(draft: NoteSave) {
    const common = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision};
    newNoteId.current ??= crypto.randomUUID();
    const mutation: BulletinReaderMutation = draft.noteId && draft.baseVersion ? {...common, kind: 'editNote', baseVersion: draft.baseVersion, payload: {noteId: draft.noteId, text: draft.text}} : {...common, kind: 'createNote', payload: {noteId: newNoteId.current, sentenceIds: noteAnchors, text: draft.text, ...(selection.ranges ? {ranges: selection.ranges} : {})}};
    noteOperation.current = {mutation, generation: generation.current};
    const result = await privateReader.mutate(mutation, false, () => {
      setNotes('list'); setNoteEditorState(undefined); newNoteId.current = null;
      if (mutation.kind === 'createNote') clearSelection();
    });
    settleNote(mutation, result);
    if (result.status !== 'applied' && result.status !== 'queued' && result.status !== 'note_conflict') throw new Error(result.status);
    return {status: result.status, note: 'note' in result ? result.note : undefined, durable: 'durable' in result ? result.durable : undefined};
  }
  async function action(mutation: BulletinReaderMutation) {
    const actedSelection = selection;
    try {
      const result = await privateReader.mutate(mutation, false, () => clearIf(actedSelection));
      const saved = result.status === 'applied' || result.status === 'queued';
      setNotice(saved ? '' : m.syncAction);
      // An older response must not dismiss a selection made while it was pending.
      if (saved) clearIf(actedSelection);
    }
    catch (error) {actionError(error);}
  }
  async function deleteNote(note: BulletinReaderNote) {
    const mutation: BulletinReaderMutation = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'deleteNote', baseVersion: note.version, payload: {noteId: note.id}};
    noteOperation.current = {mutation, generation: generation.current, local: deletion?.local ?? note};
    try {settleNote(mutation, await privateReader.mutate(mutation));}
    catch (error) {actionError(error);}
  }
  const [restoredAnchor] = useState<Anchor | null>(() => {
    try {const anchor = JSON.parse(sessionStorage.getItem(`${storageKey}:anchor`) ?? 'null'); return anchor && ['component', 'sentence'].includes(anchor.kind) && typeof anchor.id === 'string' ? anchor : null;} catch {return null;}
  });
  const [restoredPage] = useState(() => {
    try {const id = sessionStorage.getItem(storageKey); return document.pages.findIndex(page => page.id === id);} catch {return -1;}
  });
  const [resumeResolved, setResumeResolved] = useState(false);
  const cloudProgress = privateReader.state?.progress;
  const [page, setPage] = useState(Math.max(0, restoredPage));
  const [view] = useState(() => readPaperView(storageKey));
  const [zoom, setZoom] = useState<ReaderZoom>(view.zoom);
  const [direction, setDirection] = useState<ReadingDirection>(view.direction);
  useEffect(() => {writePaperView(storageKey, {zoom, direction});}, [storageKey, zoom, direction]);
  const [paperJump, setPaperJump] = useState(0);
  const [panel, setPanel] = useState<'pages' | 'search' | 'type' | null>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome) return;
    const measure = () => {
      const shell = documentRef.current?.closest<HTMLElement>('.weekly-reader');
      shell?.style.setProperty('--reader-shell-top', `${Math.max(0, shell.getBoundingClientRect().top)}px`);
      documentRef.current?.style.setProperty('--reader-reading-inset', '8px');
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(chrome);
    window.addEventListener('resize', measure);
    return () => {observer?.disconnect(); window.removeEventListener('resize', measure);};
  }, []);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const [sourceJump, setSourceJump] = useState<{page: number; focus: boolean} | null>(null);
  const previousReflow = useRef(reflow);
  const chapterStart = useRef(false);
  async function openPanel(next: Exclude<typeof panel, null>, trigger: Element) {
    if (notes && !await closeNotes()) return;
    revealChrome(); clearSelection(); panelTrigger.current = trigger instanceof HTMLElement ? trigger : null; setPanel(current => current === next ? null : next);
  }
  function closePanel(restoreFocus = true) {
    setPanel(null);
    if (restoreFocus) requestAnimationFrame(() => panelTrigger.current?.focus({preventScroll: true}));
  }
  const jumpFromSearch = useReaderSearchNavigation({root: chromeRef, open: panel === 'search', suspended, offline,
    binding: `${selector.accountId}:${value.document.documentId}:${value.document.revision}`,
    allowAction, onJump: id => {void onAnchor({kind: 'sentence', id}).then(allowed => {if (allowed) closePanel(false);});}});
  useEffect(() => {
    if (!panel) return;
    chromeRef.current?.querySelector<HTMLElement>(panel === 'search' ? '.reader-search input' : '.reader-navigation-panel:not([hidden]) > header button')?.focus({preventScroll: true});
  }, [panel]);
  const productionSentenceIds = useMemo(() => bulletinMobileDetails(document).sentenceIds, [document]);
  async function jumpBookmark(bookmark: BulletinReaderBookmark) {
    const source = value.document, targetPage = source.content.pages.findIndex(page => page.id === bookmark.pageId);
    const anchor: ReadingAnchor = {kind: 'sentence', id: bookmark.sentenceId, start: bookmark.offset, page: targetPage};
    if (bookmark.reanchorRequired || bookmark.documentRevision !== source.revision || !exactBookmarkTarget(source, anchor)) {setNotice(m.bookmarkNeedsPosition); return;}
    const hiddenFixed = bookmark.sentenceId.startsWith('canonical-') && bulletinMobileDetails(document).fixedElements.has(bookmark.sentenceId.slice('canonical-'.length));
    if (reflow && (productionSentenceIds.has(bookmark.sentenceId) || hiddenFixed)) {
      if (!await confirmReaderAction(m.bookmarkPaperConfirm, m.bookmarksTab, m.paperMode) || !await closeNotes() || !documentRef.current || !allowAction()) return;
      modeAnchor.current = anchor; suppressModeProgress.current = true; setReadingMode('paper'); writeReadingMode(storageKey, 'paper');
    } else await onAnchor({kind: 'sentence', id: bookmark.sentenceId, start: bookmark.offset}, true, targetPage);
  }
  const chapters = useMemo(() => bulletinChapters(document), [document]);
  const [chapter, setChapter] = useState(chapters[0]?.id ?? 'cover');
  const chapterIndex = chapters.findIndex(entry => entry.id === chapter);
  const hasNotes = privateReader.state?.notes.some(note => !note.deleted && (!reflow || note.ranges?.some(range => bulletinChapterForAnchor(document, {kind: 'sentence', id: range.sentenceId}) === chapter) || note.sentenceIds.some(id => bulletinChapterForAnchor(document, {kind: 'sentence', id}) === chapter))) ?? false;
  const chapterLabels = {cover: m.chapterCover, body: m.chapterBody, worship: m.chapterWorship, back: m.chapterBack};
  const chapterHeading = useRef<HTMLDivElement>(null);
  const [nativeZoomed, setNativeZoomed] = useState(false);
  const [fontsReady, setFontsReady] = useState(() => !globalThis.document?.fonts);
  const [fontsFailed, setFontsFailed] = useState(false);
  const [fontAttempt, setFontAttempt] = useState(0);
  const [viewport, setViewport] = useState({width: 900, height: 700});
  const viewportRef = useRef<HTMLDivElement>(null);
  const [typography, setTypography] = useState(readTypography);
  const iphoneStandalone = useSyncExternalStore(subscribeStandalone, iphoneStandaloneSnapshot, serverStandaloneSnapshot);
  const {visible: chromeVisible, reveal: revealChrome} = useScrollChrome({root: viewportRef, blocked: !mobile || !!panel || !!notes || selected.length > 0 || suspended});
  const readingInset = useCallback(() => Math.max(viewportRef.current?.getBoundingClientRect().top ?? 0, mobile && chromeVisible ? chromeRef.current?.querySelector('.reader-tabbar')?.getBoundingClientRect().bottom ?? 0 : 0) + 8, [mobile, chromeVisible]);
  function changeTypography(next: Typography) {
    const root = viewportRef.current;
    const anchor = Array.from(paperRef.current?.querySelectorAll<HTMLElement>('[data-sentence-id]') ?? []).find(node => node.getBoundingClientRect().bottom > readingInset());
    const top = anchor?.getBoundingClientRect().top;
    setTypography(next);
    try {localStorage.setItem('hhc-reader-typography', JSON.stringify(next));} catch { /* Optional local preference. */ }
    requestAnimationFrame(() => {if (root && anchor && top !== undefined) root.scrollTop += anchor.getBoundingClientRect().top - top;});
  }
  const {changeZoom, captureAnchor} = usePaperGestures({root: viewportRef, enabled: !reflow && !suspended, nativeTouch: mobile, blocked: !!notes, zoom, setZoom, layoutKey: `${viewport.width}:${viewport.height}`});
  const preservePaperPosition = useEffectEvent(() => {if (resumeResolved && fontsReady && !reflow) captureAnchor();});
  const pendingAnchor = useRef<(Anchor & {focus: boolean}) | null>(null);
  const gesture = useRef<{x: number; y: number; multiplePointers: boolean} | null>(null);
  const pointers = useRef(new Set<number>());
  const active = document.pages[page];
  useLayoutEffect(() => {
    if (reflow || !fontsReady || !paperRef.current) return;
    const headers = new Set(document.components.flatMap(component => {
      const header = component.type === 'bodySection' ? component.bodySection.header : undefined;
      return header ? [header.lectureDate.id, ...header.contributors.map(credit => credit.name.id)] : [];
    }));
    const cover = document.components.find(component => component.type === 'cover')?.cover;
    return fitPaperLines(paperRef.current, headers, cover ? {worship: cover.worship.flatMap(item => item.blocks.map(block => block.id)), work: cover.work.flatMap(item => item.blocks.map(block => block.id))} : undefined);
  }, [document, active.id, reflow, fontsReady, viewport.width, viewport.height, zoom, hasNotes, direction]);
  useEffect(() => {
    saveReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}, {
      revision: value.document.revision, pageId: active.id, selected, selectedRanges: selection.ranges,
      edition: {issueNumber: selector.issueNumber, series: selector.series, contentLocale: selector.contentLocale},
      draft: notes && notes !== 'list' ? noteEditorState?.draft : undefined
    });
  }, [selector.accountId, selector.issueNumber, selector.series, selector.contentLocale, value.document.documentId, value.document.revision, active.id, selected, selection.ranges, notes, noteEditorState]);
  const size = {width: active.width * 4 / 3, height: active.height * 4 / 3};
  const scale = pageScale(zoom, size, viewport);
  const zoomed = nativeZoomed || zoom > 1;
  const onPage = async (next: number, record = true) => {
    if (!Number.isFinite(next) || record && notes && !await closeNotes()) return false;
    return applyPage(next, record);
  };
  function applyPage(next: number, record = true) {
    if (!Number.isFinite(next)) return false;
    if (record && (!allowAction() || suspended || !documentRef.current)) return false;
    revealChrome();
    setResumeResolved(true);
    if (record) clearSelection();
    pendingAnchor.current = null;
    try {sessionStorage.removeItem(`${storageKey}:anchor`);} catch { /* Optional restoration. */ }
    const target = Math.max(0, Math.min(document.pages.length - 1, Math.floor(next)));
    setPage(target);
    setPaperJump(value => value + 1);
    if (reflow) {
      setSourceJump({page: target, focus: record});
      const first = sourcePageStart(value.document.content, target, reflow ? productionSentenceIds : undefined);
      setChapter(first ? bulletinChapterForAnchor(document, {kind: 'sentence', id: first.sentenceId}) ?? chapters[0].id : chapters[0].id);

    }
    if (record && !suppressModeProgress.current) progress.record(document.pages[target].id);
    return true;
  }
  useEffect(() => {
    if (!globalThis.document.fonts) return;
    let active = true;
    const timer = setTimeout(() => {active = false; setFontsFailed(true);}, 20000);
    void globalThis.document.fonts.ready.then(() => {
      if (active) {clearTimeout(timer); setFontsReady(true);}
    }, () => {if (active) {active = false; clearTimeout(timer); setFontsFailed(true);}});
    return () => {active = false; clearTimeout(timer);};
  }, [fontAttempt]);
  useEffect(() => {
    const root = documentRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWideNotes((entries[0]?.contentRect.width ?? 0) >= 1068));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const visual = window.visualViewport;
    const changed = () => {
      setNativeZoomed((visual?.scale ?? 1) > 1);
      chromeRef.current?.style.setProperty('--reader-panel-height', `${visual?.height ?? window.innerHeight}px`);
      chromeRef.current?.style.setProperty('--reader-panel-top', `${visual?.offsetTop ?? 0}px`);
    };
    changed(); visual?.addEventListener('resize', changed); visual?.addEventListener('scroll', changed); window.addEventListener('resize', changed);
    return () => {visual?.removeEventListener('resize', changed); visual?.removeEventListener('scroll', changed); window.removeEventListener('resize', changed);};
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const changed = () => {if (query.matches !== mobile && !readingMode && paperRef.current) modeAnchor.current = visibleReadingAnchor(paperRef.current, value.document.content, readingInset(), page); setMobile(query.matches);};
    changed(); query.addEventListener('change', changed);
    const root = viewportRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect?.width && rect.height) {
        preservePaperPosition();
        setViewport({width: Math.max(1, rect.width - 32 - (hasNotes ? 44 : 0)), height: Math.max(1, rect.height - 32)});
      }
    });
    if (root) observer?.observe(root);
    return () => {query.removeEventListener('change', changed); observer?.disconnect();};
  }, [hasNotes, mobile, readingMode, document, value.document.content, page, readingInset]);
  async function changeReadingMode(next: ReadingMode) {
    if (next === (reflow ? 'easy' : 'paper') || !allowAction() || suspended) return;
    const before = generation.current, previous = reflow, request = ++modeRequest.current;
    const anchor = paperRef.current ? visibleReadingAnchor(paperRef.current, value.document.content, readingInset(), page) : null;
    if (notes && !await closeNotes()) return;
    if (!documentRef.current || !allowAction() || suspended || previous !== currentReflow.current || request !== modeRequest.current || (notes === null && before !== generation.current)) return;
    modeAnchor.current = anchor; suppressModeProgress.current = true;
    clearSelection(); setReadingMode(next); writeReadingMode(storageKey, next);
  }
  const applyReadingMode = useEffectEvent(() => {
    if (reflow === previousReflow.current) return;
    previousReflow.current = reflow; suppressModeProgress.current = true;
    const saved = modeAnchor.current ?? {kind: 'sentence' as const, id: sourcePageStart(value.document.content, page)?.sentenceId ?? '', page};
    modeAnchor.current = null;
    const target = resolveReadingAnchor(value.document.content, saved, reflow ? productionSentenceIds : undefined);
    if (!target) {setNotice(m.modePositionUnavailable); return;}
    applyPage(target.anchor.page, false);
    const nextChapter = bulletinChapterForAnchor(document, target.anchor);
    if (nextChapter) setChapter(nextChapter);
    setSourceJump(null); pendingAnchor.current = {...target.anchor, focus: false};
    if (target.fallback) setNotice(m.modePositionFallback);
  });
  useEffect(() => {applyReadingMode();}, [reflow]);
  useEffect(() => {
    if (!resumeResolved) return;
    try {sessionStorage.setItem(storageKey, active.id);} catch { /* Reading remains available without storage. */ }
  }, [active.id, storageKey, resumeResolved]);
  const scrollToPage = useEffectEvent(() => {
    const viewport = viewportRef.current;
    if (!viewport || !fontsReady || !resumeResolved) return;
    if (reflow) {
      if (chapterStart.current) {
        // Imperative scrolling of a DOM element, not a React state mutation.
        viewport.scrollTop = 0;
        chapterStart.current = false; pendingAnchor.current = null;
        chapterHeading.current?.focus({preventScroll: true});
        return;
      }
      const anchor = pendingAnchor.current;
      if (anchor) {
        const attribute = `data-${anchor.kind}-id`;
        const element = Array.from(viewport.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(element => element.getAttribute(attribute) === anchor.id);
        if (element) {
          // Imperative DOM scrolling; this does not mutate React state or the ref itself.
          const range = anchor.kind === 'sentence' && anchor.start !== undefined ? renderedTextRanges(viewport, {sentenceId: anchor.id, start: anchor.start, end: anchor.start + 1})[0] : undefined;
          viewport.scrollTop += (range?.getBoundingClientRect().top ?? element.getBoundingClientRect().top) - readingInset();
          if (anchor.focus) {
            element.tabIndex = -1;
            element.focus({preventScroll: true});
          }
        }
        pendingAnchor.current = null;
      }
      return;
    }
    const target = viewport.querySelector<HTMLElement>(`[data-paper-index="${page}"]`);
    if (target) {
      viewport.scrollTop += target.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 16;
      viewport.scrollLeft = 0;
    }
    const anchor = pendingAnchor.current;
    if (anchor) {
      const attribute = `data-${anchor.kind}-id`;
      const destination = Array.from(target?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id);
      if (destination) {
        const range = anchor.kind === 'sentence' && anchor.start !== undefined ? renderedTextRanges(target!, {sentenceId: anchor.id, start: anchor.start, end: anchor.start + 1})[0] : undefined;
        if (range && typeof range.getBoundingClientRect === 'function') viewport.scrollTop += range.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 16;
        else destination.scrollIntoView({block: 'start'});
        if (anchor.focus) {
          destination.tabIndex = -1;
          destination.focus({preventScroll: true});
        }
      }
      pendingAnchor.current = null;
    }
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToPage());
    return () => cancelAnimationFrame(frame);
  }, [paperJump, direction, reflow, fontsReady, resumeResolved, chapter]);
  function recordVisiblePaper() {
    const root = viewportRef.current;
    if (!root || reflow || direction !== 'vertical' || !resumeResolved || !fontsReady || suspended || notes || !allowAction() || suppressModeProgress.current) return;
    const top = root.getBoundingClientRect().top + 24;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-paper-index]'));
    const visible = pages.find(element => element.getBoundingClientRect().bottom > top);
    if (!visible || visible.getBoundingClientRect().height === 0) return;
    const next = Number(visible.dataset.paperIndex);
    const sentence = Array.from(visible.querySelectorAll<HTMLElement>('[data-sentence-id]')).find(element => element.getBoundingClientRect().bottom > top);
    const id = sentence?.dataset.sentenceId;
    try {
      sessionStorage.setItem(storageKey, document.pages[next].id);
      if (id) sessionStorage.setItem(`${storageKey}:anchor`, JSON.stringify({kind: 'sentence', id}));
      else sessionStorage.removeItem(`${storageKey}:anchor`);
    } catch { /* Optional restoration. */ }
    if (next !== page) setPage(next);
    recordProgress(document.pages[next].id, id);
  }
  const exit = useReaderExitGuard({canPrompt: () => !decisionRequest.current, hasUnsavedNote, hasUnsavedChanges: privateReader.hasUncommitted, messages: m, beforeLeave: async isCurrent => {
    const dirty = hasUnsavedNote();
    if (allowAction()) {
      recordVisiblePaper();
      let visiblePage = active.id;
      try {visiblePage = sessionStorage.getItem(storageKey) ?? active.id;} catch { /* Optional local progress. */ }
      saveReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}, {revision: value.document.revision, pageId: visiblePage});
      if (!privateReader.busy) await flushReaderProgressBeforeExit(flushProgress);
    }
    if (!documentRef.current || !isCurrent()) return false;
    if (dirty && allowAction()) saveReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}, {draft: undefined});
    cleanupNotes();
    return true;
  }});
  const observePaperPage = useEffectEvent(recordVisiblePaper);
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || reflow || direction !== 'vertical') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scroll = () => {clearTimeout(timer); timer = setTimeout(() => {timer = undefined; observePaperPage();}, 150);};
    const hide = () => {
      if (globalThis.document.visibilityState !== 'hidden' || timer === undefined) return;
      clearTimeout(timer); timer = undefined; observePaperPage(); void flushProgress();
    };
    root.addEventListener('scroll', scroll, {passive: true});
    globalThis.document.addEventListener('visibilitychange', hide);
    return () => {clearTimeout(timer); root.removeEventListener('scroll', scroll); globalThis.document.removeEventListener('visibilitychange', hide);};
  }, [reflow, direction, flushProgress]);
  useEffect(() => {
    if (!reflow || !fontsReady || !sourceJump) return;
    const target = sourceJump.page;
    const first = sourcePageStart(value.document.content, target, reflow ? productionSentenceIds : undefined);
    const frame = requestAnimationFrame(() => {
      if (!paperRef.current) return;
      setSourceJump(null);
      const rect = target === 0 ? paperRef.current.getBoundingClientRect() : first && renderedTextRanges(paperRef.current, first)[0]?.getBoundingClientRect();
      if (rect && viewportRef.current) viewportRef.current.scrollTop += rect.top - readingInset();
      const destination = first ? Array.from(paperRef.current.querySelectorAll<HTMLElement>('[data-sentence-id]')).find(element => element.dataset.sentenceId === first.sentenceId) : chapterHeading.current;
      if (destination && sourceJump.focus) {destination.tabIndex = -1; destination.focus({preventScroll: true});}
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceJump, reflow, fontsReady, value.document.content, chapter, productionSentenceIds, readingInset]);
  useEffect(() => {
    if (!reflow || !fontsReady || notes) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = () => {
      timer = undefined;
      if (!allowAction() || suppressModeProgress.current) return;
      const top = readingInset();
      const sentence = Array.from(viewportRef.current?.querySelectorAll<HTMLElement>('[data-sentence-id]') ?? []).find(element => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > top && rect.top < window.innerHeight;
      });
      const id = sentence?.dataset.sentenceId;
      if (!id) return;
      const index = sourcePageForSentence(viewportRef.current!, value.document.content, id, top, window.innerHeight);
      if (index < 0) return;
      setResumeResolved(true); setPage(index);
      try {sessionStorage.setItem(`${storageKey}:anchor`, JSON.stringify({kind: 'sentence', id}));} catch { /* Optional restoration. */ }
      recordProgress(value.document.content.pages[index].id, id);
    };
    const scroll = () => {clearTimeout(timer); timer = setTimeout(settled, 250);};
    const hide = () => {
      if (globalThis.document.visibilityState !== 'hidden' || timer === undefined) return;
      clearTimeout(timer); settled(); void flushProgress();
    };
    const scrollRoot = viewportRef.current;
    scrollRoot?.addEventListener('scroll', scroll, {passive: true});
    globalThis.document.addEventListener('visibilitychange', hide);
    return () => {clearTimeout(timer); scrollRoot?.removeEventListener('scroll', scroll); globalThis.document.removeEventListener('visibilitychange', hide);};
  }, [reflow, fontsReady, notes, allowAction, value.document, storageKey, recordProgress, flushProgress, chapter, readingInset]);
  async function onAnchor(anchor: Anchor, record = true, preferredPage?: number) {
    const matches = document.layoutManifest.pages.filter(layout => layout.slots.some(slot => anchor.kind === 'component' ? slot.componentId === anchor.id : slot.fragments.some(fragment => fragment.sentenceId === anchor.id && (anchor.start === undefined || fragment.start <= anchor.start && fragment.end > anchor.start))) || anchor.kind === 'sentence' && layout.fixedSlots?.some(slot => `canonical-${slot.element}` === anchor.id));
    const layout = matches.find(layout => layout.pageId === document.pages[preferredPage ?? -1]?.id) ?? matches[0];
    const index = document.pages.findIndex(page => page.id === layout?.pageId);
    if (index < 0) return false;
    if (reflow && anchor.kind === 'sentence' && productionSentenceIds.has(anchor.id)) {setNotice(m.modePositionFallback); return false;}
    if (record && notes && !await closeNotes()) return false;
    if (!applyPage(index, record)) return false;
    const targetChapter = bulletinChapterForAnchor(document, anchor);
    if (targetChapter) setChapter(targetChapter);
    setSourceJump(null);
    if (record && anchor.kind === 'sentence') progress.record(document.pages[index].id, anchor.id);
    pendingAnchor.current = {...anchor, focus: record};
    try {sessionStorage.setItem(`${storageKey}:anchor`, JSON.stringify(anchor));} catch { /* Optional restoration. */ }
    if (!reflow && index === page) {
      const attribute = `data-${anchor.kind}-id`;
      Array.from(viewportRef.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id)?.scrollIntoView({block: 'start'});
    }
    return true;
  }
  async function onChapter(index: number) {
    const target = chapters[index];
    if (!target || !allowAction() || suspended) return false;
    const layout = document.layoutManifest.pages.find(layout => layout.slots.some(slot => slot.componentId === target.componentIds[0]));
    const page = document.pages.findIndex(page => page.id === layout?.pageId);
    if (page < 0 || notes && !await closeNotes()) return false;
    if (!applyPage(page)) return false;
    setSourceJump(null); pendingAnchor.current = null;
    chapterStart.current = true; setChapter(target.id); return true;
  }
  const restorePosition = useEffectEvent(() => {
    // Restore once, without rewriting progress or letting late sync undo navigation.
    if (resumeResolved || suspended) return;
    const local = restoredPage >= 0 || !!restoredAnchor;
    const target = local ? Math.max(0, restoredPage) : Math.max(0, document.pages.findIndex(page => page.id === cloudProgress?.pageId));
    const anchor = local ? restoredAnchor : cloudProgress?.sentenceId ? {kind: 'sentence' as const, id: cloudProgress.sentenceId} : cloudProgress?.componentId ? {kind: 'component' as const, id: cloudProgress.componentId} : null;
    if (!applyPage(target, false)) return;
    if (anchor) void onAnchor(anchor, false, target);
  });
  useEffect(() => {
    if (resumeResolved || !fontsReady || suspended) return;
    if (restoredPage < 0 && !restoredAnchor && !privateReader.state && privateReader.status === 'syncing') return;
    // Anchor scrolling needs the font-ready page's completed layout.
    const frame = requestAnimationFrame(() => {void restorePosition();});
    return () => cancelAnimationFrame(frame);
  }, [resumeResolved, fontsReady, suspended, restoredPage, restoredAnchor, privateReader.state, privateReader.status]);
  const operationMessage = privateReader.operation === 'confirming' ? m.operationUnknown : privateReader.operation === 'waiting' ? m.operationWaiting : privateReader.operation === 'sending' ? m.operationSending : privateReader.operation === 'timeout' ? m.operationTimeout : '';
  const unknownAction = privateReader.canRetry && !!privateReader.pendingMutation && !privateReader.busy;
  const currentNotice = notice === m.noteQueued && privateReader.status === 'synced' ? '' : notice;
  const urgentOperation = privateReader.operation === 'confirming' || privateReader.operation === 'timeout' ? operationMessage : '';
  const feedbackMessage = privateReader.unsaved ? m.syncUnsaved : urgentOperation || (unknownAction ? m.operationUnknown : privateReader.status === 'action' || privateReader.status === 'paused' ? undefined : currentNotice || undefined);
  const feedback = <div className="reader-private-feedback">
    <div hidden={recoveryOpen} inert={recoveryOpen}>
    {privateReader.loadError ? <div role="alert"><p>{m.notesLoadError}</p><button type="button" disabled={privateReader.busy} onClick={privateReader.reload}>{m.retry}</button></div> : null}
    {!privateReader.loadError && privateReader.state && (feedbackMessage || privateReader.status === 'action' || privateReader.status === 'paused') ? <SyncStatus status={privateReader.status} messages={m}>{feedbackMessage}</SyncStatus> : null}
    {privateReader.operation === 'waiting' || privateReader.operation === 'confirming' ? <button type="button" onClick={privateReader.cancelWaiting}>{m.cancelWaiting}</button> : null}
    {!privateReader.busy && privateReader.canRetry && privateReader.status !== 'paused' ? <><p>{privateReader.operation === 'confirming' ? m.retryContinues : m.confirmRetryHelp}</p><button type="button" disabled={privateReader.busy} onClick={() => {
      const mutation = privateReader.pendingMutation, snapshot = selection;
      void privateReader.retry().then(result => {
        if (!mutation || !result) return;
        if (isBookmarkMutation(mutation)) settleBookmark(mutation, result); else settleNote(mutation, result);
        if (result.status === 'applied' && (mutation.kind === 'setHighlight' || mutation.kind === 'clearHighlight')) clearIf(snapshot);
      }).catch(actionError);
    }}>{m.confirmRetry}</button></> : null}
    </div>
    <div ref={recoveryControl}><ReaderRecovery onBookmarkRetry={privateReader.retry} onConfirm={description => confirmReaderAction(description, m.reviewSync, m.applyUpdate)} inline={!!notes} onOpenChange={setRecoveryOpen} onState={privateReader.acceptState} available={!privateReader.busy && (privateReader.status === 'paused' || privateReader.status === 'action' || !!privateReader.pendingMutation)} runExclusive={privateReader.runExclusive} api={api} value={value} selector={selector} messages={m} mobile={mobile} onUpdated={next => {privateReader.reload(); onUpdated(next);}} onFailure={onFailure} suspended={suspended} pendingMutation={privateReader.pendingMutation} onPendingChange={(mutation, result, previous) => {
      if (mutation && previous && noteOperation.current?.mutation.mutationId === previous.mutationId && noteOperation.current.generation === generation.current) noteOperation.current = {...noteOperation.current, mutation};
      const remaining = privateReader.replacePending(mutation, previous?.mutationId ?? null);
      if (!mutation && previous && result) {if (isBookmarkMutation(previous)) settleBookmark(previous, result); else settleNote(previous, result);}
      else if (!mutation && previous && !isBookmarkMutation(previous) && noteOperation.current?.mutation.mutationId === previous.mutationId && noteOperation.current.generation === generation.current) cleanupNotes();
      return remaining;
    }}/></div>
  </div>;
  return <section ref={documentRef} className="reader-document" data-mobile={mobile || undefined} data-reading-mode={reflow ? 'easy' : 'paper'} data-mobile-hidden={!chromeVisible} data-iphone-standalone={iphoneStandalone || undefined} data-panel-open={!!panel || undefined} data-notes-panel={notes && wideNotes || undefined} aria-label={m.title} role="region" onWheelCapture={() => {suppressModeProgress.current = false;}} onTouchMoveCapture={() => {suppressModeProgress.current = false;}} onPointerDownCapture={() => {suppressModeProgress.current = false;}} onKeyDown={event => {
    if (exportRequest) return;
    suppressModeProgress.current = false;
    if (event.key === 'Tab' && panel) {
      const panelRoot = chromeRef.current?.querySelector<HTMLElement>('.reader-navigation-panel:not([hidden])');
      const focusable = Array.from(panelRoot?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],summary') ?? []);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && globalThis.document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && globalThis.document.activeElement === last) {event.preventDefault(); first?.focus();}
    }
    if (event.key === 'Escape' && panel) {event.preventDefault(); closePanel(); return;}
    if (panel) return;
    if (event.key === 'Escape' && !notes) {clearSelection(); return;}
    const delta = keyboardPageDelta(event, !!window.getSelection()?.toString());
    if (!reflow && direction === 'horizontal' && delta) {event.preventDefault(); void onPage(page + delta);}
  }}>
    {exportRequest && !suspended ? <NoteExportDialog messages={m} theme={theme} document={value.document} locale={backHref.split('/')[1] as Locale} issueNumber={selector.issueNumber} visibleIds={exportRequest.ids} total={privateReader.state?.notes.filter(note => !note.deleted).length ?? 0} prepare={privateReader.prepareExport} current={() => !!documentRef.current && allowAction() && !suspended && generation.current === exportRequest.generation} onClose={() => setExportRequest(null)}/> : null}
    <ReaderExitDialog exit={exit} theme={theme}/>
    <AlertDialog isOpen={!!decision} title={decision?.title ?? m.myNotes} description={<span ref={node => {
      const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay');
      if (overlay) {overlay.dataset.readerExit = ''; overlay.dataset.theme = theme; overlay.style.colorScheme = theme;}
    }}>{decision?.description}{decision?.text ? <span className="reader-note-text">{decision.text.slice(0, 180)}</span> : null}</span>} cancelLabel={decision?.cancelLabel ?? m.noteCancel} closeLabel={m.close} confirmLabel={decision?.confirmLabel ?? m.noteDiscard} confirmVariant="danger" onOpenChange={open => {if (!open) settleDecision(false);}} onConfirm={() => settleDecision(true)}/>

    <div ref={chromeRef} className="reader-chrome">
      <div className="reader-chrome-controls" inert={!!panel}>
      <ReaderTabs accountId={selector.accountId} locale={backHref.split('/')[1] as Locale} current={selector} title={value.document.canonicalMetadata.title} messages={m} beforeLeave={() => exit.confirmLeave('home')} beforeNavigate={async () => {
        if (!allowAction() || notes && !await closeNotes()) return false;
        const beforeFlush = generation.current;
        recordVisiblePaper();
        await flushProgress();
        return allowAction() && !!documentRef.current && beforeFlush === generation.current;
      }} search={<IconButton variant="ghost" aria-label={m.search} title={m.search} aria-expanded={panel === 'search'} onPress={event => {void openPanel('search', event.target);}} icon={<Search size={20} aria-hidden="true"/>}/>}/>
      <header className={mobile ? "reader-topbar site-mobile-tab-bar" : "reader-topbar"} data-mobile-hidden={!chromeVisible} data-iphone-standalone={iphoneStandalone || undefined} aria-label={m.title}>
        <IconButton variant="ghost" aria-label={mobile ? m.contents : m.thumbnails} title={mobile ? m.contents : m.thumbnails} aria-expanded={panel === 'pages'} onPress={event => {void openPanel('pages', event.target);}} icon={<PanelLeft size={20} aria-hidden="true"/>}/>
        {mobile ? <IconButton variant="ghost" aria-label={m.typography} aria-expanded={panel === 'type'} onPress={event => {void openPanel('type', event.target);}} icon={<ALargeSmall size={20} aria-hidden="true"/>}/> : null}
        <IconButton variant="ghost" aria-label={theme === 'dark' ? m.lightMode : m.darkMode} title={theme === 'dark' ? m.lightMode : m.darkMode} aria-pressed={theme === 'dark'} onPress={toggleTheme} icon={theme === 'dark' ? <Sun size={20} aria-hidden="true"/> : <Moon size={20} aria-hidden="true"/>}/>
        <IconButton buttonRef={notesButton} variant="ghost" aria-label={m.myNotes} aria-description={m.savedHighlights} title={m.myNotes} isDisabled={!privateReader.state} onPress={() => {revealChrome(); setPanel(null); void openNotesList(null);}} icon={<NotebookPen size={20} aria-hidden="true"/>}/>
        {offlineControl}
        {!mobile && !reflow ? <ReaderToolbar messages={m} zoom={zoom} setZoom={changeZoom}/> : null}
        {!mobile && !reflow ? <div className="reader-direction-controls" role="group" aria-label={m.readingDirection}>
          <IconButton variant="ghost" aria-label={`${m.readingDirection}: ${m[direction]}`} title={`${m[direction]} → ${m[direction === 'vertical' ? 'horizontal' : 'vertical']}`} aria-pressed={direction === 'horizontal'} onPress={async () => {if (notes && !await closeNotes()) return; clearSelection(); setPanel(null); setDirection(current => current === 'vertical' ? 'horizontal' : 'vertical');}} icon={direction === 'vertical' ? <ChevronsUpDown size={20} aria-hidden="true"/> : <ChevronsLeftRight size={20} aria-hidden="true"/>}/>
        </div> : null}
      </header>
      </div>
      {panel ? <div className="reader-panel-backdrop" data-clear={panel === 'type' || undefined} aria-hidden="true" onClick={() => closePanel()}/> : null}
      <aside className="reader-navigation-panel" role="dialog" aria-modal="true" data-panel={panel} hidden={!panel || panel === 'search'} aria-label={panel === 'pages' ? mobile ? m.contents : m.thumbnails : m.typography}>
        <header><h2>{panel === 'pages' ? mobile ? m.contents : m.thumbnails : m.typography}</h2><IconButton variant="ghost" aria-label={m.close} onPress={() => closePanel()} icon={<X size={20} aria-hidden="true"/>}/></header>
        {panel === 'pages' || panel === 'type' ? <div className="reader-mode-settings">
          <div role="group" aria-label={m.readingMode} className="reader-mode-controls">{(['paper', 'easy'] as const).map(mode => <button key={mode} type="button" aria-pressed={(reflow ? 'easy' : 'paper') === mode} onClick={() => {void changeReadingMode(mode);}}>{mode === 'paper' ? m.paperMode : m.easyMode}</button>)}</div>
          {reflow ? <ReaderTypography value={typography} onChange={changeTypography} messages={m}/> : mobile ? <><ReaderToolbar messages={m} zoom={zoom} setZoom={changeZoom}/><button type="button" aria-label={`${m.readingDirection}: ${m[direction]}`} onClick={() => setDirection(current => current === 'vertical' ? 'horizontal' : 'vertical')}>{m[direction]}</button></> : null}
        </div> : null}
        {panel === 'pages' ? <>
          {reflow ? <nav className="reader-chapters" aria-label={m.chapters}>{chapters.map((entry, index) => <Button key={entry.id} variant="ghost" aria-current={entry.id === chapter ? 'location' : undefined} onPress={() => {void onChapter(index).then(allowed => {if (allowed) closePanel(false);});}}>{chapterLabels[entry.id]}</Button>)}</nav> : null}
          {reflow ? <details className="reader-original-pages"><summary>{m.originalPages}</summary><PageNavigator document={document} metadata={value.document.canonicalMetadata} traceCode={value.access.traceCode} theme={theme} page={page} onPage={target => {void onPage(target).then(allowed => {if (allowed) closePanel(false);});}} messages={m}/></details> : <PageNavigator document={document} metadata={value.document.canonicalMetadata} traceCode={value.access.traceCode} theme={theme} page={page} onPage={target => {void onPage(target).then(allowed => {if (allowed) closePanel();});}} messages={m}/>}
          <SectionNavigator document={document} onSection={anchor => {void onAnchor(anchor).then(allowed => {if (allowed) closePanel(!mobile);});}} messages={m}/>
        </> : null}
      </aside>
      <aside className="reader-navigation-panel reader-search-panel" role="dialog" aria-modal="true" data-panel="search" hidden={panel !== 'search'} aria-label={m.search}>
        <ReaderSearch document={value.document} mobile={reflow} onJump={jumpFromSearch} messages={m} closeControl={<IconButton variant="ghost" aria-label={m.close} onPress={() => closePanel()} icon={<ChevronLeft size={22} aria-hidden="true"/>}/>}/>
      </aside>
    </div>
    {value.document.metadataSyncPending ? <p role="status">{m.metadataPending}</p> : null}
    {!notes ? feedback : null}
    <div className="reader-stage" inert={!!panel}>
    <div ref={viewportRef} className="reader-viewport" data-mobile={mobile || undefined} data-direction={reflow ? undefined : direction} data-active-page={active.id} style={{touchAction: mobile || reflow || notes || nativeZoomed ? 'auto' : direction === 'horizontal' && !zoomed ? 'pan-y' : 'pan-x pan-y'}} tabIndex={0} onContextMenu={event => {if (!(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]'))) event.preventDefault();}} onClick={event => {
      if (mobile && !(event.target instanceof Element && event.target.closest('button,a,input,textarea,select,[contenteditable]'))) revealChrome();
    }} onPointerDown={event => {
      if (event.pointerType !== 'touch' || notes || reflow || suspended) return;
      pointers.current.add(event.pointerId);
      if (!gesture.current) gesture.current = {x: event.clientX, y: event.clientY, multiplePointers: false};
      if (pointers.current.size > 1) gesture.current.multiplePointers = true;
    }} onPointerCancel={() => {pointers.current.clear(); gesture.current = null;}} onPointerUp={event => {
      pointers.current.delete(event.pointerId);
      const start = gesture.current;
      if (!start || pointers.current.size) return;
      gesture.current = null;
      const delta = swipeDirection({...start, dx: event.clientX - start.x, dy: event.clientY - start.y, zoomed: zoomed || (window.visualViewport?.scale ?? 1) > 1, hasSelection: !!window.getSelection()?.toString()});
      if (!reflow && direction === 'horizontal' && delta) void onPage(page + delta);
  }}>
      {reflow && chapterIndex > 0 ? <div className="reader-chapter-boundary"><IconButton variant="ghost" aria-label={m.previous} isDisabled={suspended} onPress={() => {void onChapter(chapterIndex - 1);}} icon={<ArrowUp size={20} aria-hidden="true"/>}/></div> : null}
      {!fontsReady ? fontsFailed ? <div className="reader-font-error" role="alert"><p>{m.unavailable}</p><Button variant="secondary" onPress={() => {setFontsFailed(false); setFontAttempt(attempt => attempt + 1);}}>{m.retry}</Button></div> : <ReaderLoading label={m.loading} overlay/> : null}
      <div ref={paperRef} className="reader-paper-with-notes" data-has-notes={hasNotes || undefined} inert={!fontsReady} aria-hidden={!fontsReady || undefined} style={{visibility: fontsReady ? 'visible' : 'hidden', width: reflow ? undefined : Math.max(...document.pages.map(entry => entry.width * 4 / 3 * pageScale(zoom, {width: entry.width * 4 / 3, height: entry.height * 4 / 3}, viewport))) + (hasNotes ? 44 : 0)}}>
      {reflow ? <div ref={chapterHeading} tabIndex={-1} role="group" aria-label={chapterLabels[chapter]} className="reader-watermarked" style={{"--reader-font-size": `${typography.size}px`, "--reader-line-height": typography.line} as React.CSSProperties}><BulletinEbook document={document} chapter={chapter} canonicalMetadata={value.document.canonicalMetadata} sentenceState={sentenceState} selectable={mobile && !notes && !suspended}/><ReaderWatermark traceCode={value.access.traceCode} tone={theme}/></div> :
        <PaperViewport selectable={mobile && !notes && !suspended} document={document} metadata={value.document.canonicalMetadata} sentenceState={sentenceState} traceCode={value.access.traceCode} theme={theme} page={page} direction={direction} zoom={zoom} viewport={viewport}/>}
      <NoteIndicators root={paperRef} notes={privateReader.state?.notes ?? []} layoutKey={reflow ? `${chapter}:${fontsReady}:${typography.size}:${typography.line}` : `${active.id}:${scale}:${fontsReady}:${direction}`} label={m.myNotes} onOpen={(ids, trigger) => {void openNotesList(ids, trigger);}} mobile={reflow}/>
      <RangeHighlights root={paperRef} highlights={savedHighlights} layoutKey={reflow ? `${chapter}:${fontsReady}:${typography.size}:${typography.line}` : `${active.id}:${scale}:${fontsReady}:${direction}`} onSelect={mobile ? undefined : selectExisting}/>
      </div>
      {reflow && chapterIndex < chapters.length - 1 ? <div className="reader-chapter-boundary"><IconButton variant="ghost" aria-label={m.next} isDisabled={suspended} onPress={() => {void onChapter(chapterIndex + 1);}} icon={<ArrowDown size={20} aria-hidden="true"/>}/></div> : null}
    </div>
    </div>
    {!reflow && direction === 'horizontal' ? <div className="reader-page-controls" role="group" aria-label={m.originalPages}>
      {page > 0 ? <IconButton variant="ghost" aria-label={m.previous} title={m.previous} isDisabled={suspended || page === 0} onPress={() => {void onPage(page - 1);}} icon={<ChevronLeft size={20} aria-hidden="true"/>}/> : null}
      {page < document.pages.length - 1 ? <IconButton variant="ghost" aria-label={m.next} title={m.next} isDisabled={suspended || page >= document.pages.length - 1} onPress={() => {void onPage(page + 1);}} icon={<ChevronRight size={20} aria-hidden="true"/>}/> : null}
    </div> : null}
    <SelectionToolbar messages={m} root={paperRef} ranges={selectionRanges} count={selecting ? 0 : selectionRanges.reduce((count, range) => count + range.end - range.start, 0)} color={highlightSelection.color} clearable={highlightSelection.clearable} busy={foregroundBusy || !privateReader.state || privateReader.status === 'paused'} noteOpen={!!notes} noteButtonRef={noteButton}
      onColor={color => void action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'setHighlight', payload: {sentenceIds: selected, color, ...(selection.ranges ? {ranges: selection.ranges} : {})}})}
      onClear={() => void action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'clearHighlight', payload: {sentenceIds: selected, ...(selection.ranges ? {ranges: selection.ranges} : {})}})}
      onCopy={() => {const snapshot = selection; void (selection.ranges ? copyTextRanges(value.document, selection.ranges, allowAction) : copySentences(value.document, selected, allowAction)).then(() => {setNotice(m.copySuccess); clearIf(snapshot);}).catch(() => setNotice(m.copyFailed));}}
      onNote={() => {newNoteId.current = null; setNoteEditorState(undefined); setNotes('new');}}/>
    {notes ? <ReaderPrivateState wide={wideNotes} theme={theme} messages={m} onClose={() => {void closeNotes();}} suspended={suspended}>
      {feedback}
      <div className="reader-private-content" hidden={recoveryOpen} inert={recoveryOpen}>
      {notes === 'list' && !privateReader.state ? !privateReader.loadError ? <ReaderLoading label={m.loading}/> : null : reanchor ? <NoteReanchor initialConflict={reanchorConflict} onRecover={openRecovery} key={`${reanchor.id}:${reanchorConflict ? 'conflict' : 'editing'}:${reanchorConflict?.note?.version ?? reanchor.version}`} note={reanchor} document={value.document} messages={m} mobile={mobile} suspended={suspended} onSave={async (note, ranges) => {
        const mutation: BulletinReaderMutation = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'reanchorNote', baseVersion: note.version, payload: {noteId: note.id, sentenceIds: ranges.map(range => range.sentenceId), ranges}};
        noteOperation.current = {mutation, generation: generation.current, local: note};
        const result = await privateReader.mutate(mutation);
        if (result.status === 'applied' || result.status === 'queued') settleNote(mutation, result);
        if (result.status !== 'applied' && result.status !== 'queued' && result.status !== 'note_conflict') throw new Error(result.status);
        return {status: result.status, note: 'note' in result ? result.note : undefined, durable: 'durable' in result ? result.durable : undefined};
      }} onComplete={() => {}} onCancel={() => setReanchor(null)}/> : deletion ? <section className="reader-note-editor"><p role="alert">{m.noteConflict}</p><h3>{m.recoveryLocal}</h3><blockquote>{deletion.local.text}</blockquote><h3>{m.recoveryCloud}</h3><blockquote>{!deletion.durable && deletion.cloud && !deletion.cloud.deleted ? deletion.cloud.text : m.noteDeleted}</blockquote><div className="reader-note-actions">
        <button type="button" disabled={foregroundBusy} onClick={() => {if (deletion.durable) openRecovery(); else {privateReader.replacePending(null, deletion.mutationId); setDeletion(null);}}}>{deletion.durable ? m.reviewSync : m.noteCloud}</button>
        {!deletion.durable && deletion.cloud && !deletion.cloud.deleted ? <><button type="button" disabled={privateReader.busy} onClick={() => {const note = deletion.cloud!; void confirmNote('delete', note.text).then(accepted => {if (accepted) {privateReader.replacePending(null, deletion.mutationId); void deleteNote(note);}});}}>{m.noteDelete}</button><button type="button" disabled={privateReader.busy} onClick={() => {const cloud = deletion.cloud!; privateReader.replacePending(null, deletion.mutationId); setNotes(cloud); setNoteEditorState({draft: {noteId: cloud.id, baseVersion: cloud.version, text: `${cloud.text}\n\n${deletion.local.text}`}, conflict: null}); setDeletion(null);}}>{m.noteManual}</button></> : null}
      </div></section> : notes === 'list' ? <>
      <ReaderNotesList messages={m} bookmarks={{document: value.document, bookmarks: privateReader.state?.bookmarks, messages: m, offline, supported: privateReader.bookmarksSupported, cacheWarning: privateReader.bookmarkCacheWarning,
          busy: privateReader.busy || privateReader.canRetry || privateReader.loadError || suspended || !privateReader.state || privateReader.status === 'paused', draft: bookmarkDraft, onDraft: setBookmarkDraft, onCurrent: captureBookmarkPosition,
          onSave: () => {void saveBookmark();}, onJump: bookmark => {void jumpBookmark(bookmark);}, onDelete: bookmark => {const draft: BookmarkDraft = {kind: 'delete', id: bookmark.id, name: bookmark.name, originalName: bookmark.name, baseVersion: bookmark.version, target: bookmark}; setBookmarkDraft(draft); void saveBookmark(draft);}}} onExport={ids => setExportRequest({ids, generation: generation.current})} exportDisabled={privateReader.busy || privateReader.loadError || privateReader.canRetry || recoveryOpen || !privateReader.state || ['paused', 'action', 'syncing'].includes(privateReader.status)} filter={noteFilter} onClearFilter={() => setNoteFilter(null)}
        highlights={{highlights: savedHighlights, sentences, messages: m, busy: foregroundBusy || !privateReader.state || privateReader.status === 'paused' || suspended,
          onChange: (range, color) => action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, ...(color ? {kind: 'setHighlight' as const, payload: {sentenceIds: [range.sentenceId], ranges: [range], color}} : {kind: 'clearHighlight' as const, payload: {sentenceIds: [range.sentenceId], ranges: [range]}})})}}
        notes={{busy: foregroundBusy || suspended, messages: m, notes: privateReader.state?.notes ?? [], onReanchor: setReanchor,
          onJump: id => {void onAnchor({kind: 'sentence', id});}, onEdit: note => {newNoteId.current = null; setNoteEditorState(undefined); setNotes(note);},
          onDelete: note => {void confirmNote('delete', note.text).then(accepted => {if (accepted) void deleteNote(note);});}}}/>
</> : notes === 'restore' && (!editingNote || editingNote.deleted) ? <section className="reader-note-editor">
        <p role="status">{!privateReader.state ? m.loading : m.noteDeleted}</p>
        <textarea aria-label={m.noteText} readOnly rows={8} value={noteEditorState?.draft.text ?? ''}/>
        <button type="button" onClick={() => {void closeNotes();}}>{m.noteCancel}</button>
      </section> : <NoteEditor failureHandled={unknownAction || !!operationMessage} onKeepCloud={finishNoteEditor} onRecover={openRecovery} key={editingNote?.id ?? 'new'} messages={m} note={editingNote} quote={noteQuote} editorState={noteEditorState} onEditorStateChange={setNoteEditorState} onSave={saveNote} onComplete={() => {}} onCancel={() => {void closeNotes();}}/>}
      </div>
      <div className="reader-private-sync-slot">{privateReader.state && !feedbackMessage && ['syncing', 'waiting'].includes(privateReader.status) ? <SyncStatus status={privateReader.status} messages={m}/> : null}</div>
    </ReaderPrivateState> : null}
  </section>;
}
