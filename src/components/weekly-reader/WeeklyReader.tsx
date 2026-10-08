'use client';

import {useCallback, useEffect, useEffectEvent, useLayoutEffect, useSyncExternalStore, useMemo, useRef, useState, type ReactNode} from 'react';
import {NotebookPen, Search, ALargeSmall, ArrowUp, ArrowDown, X, ChevronsUpDown, ChevronsLeftRight, ChevronLeft, ChevronRight, PanelLeft, Moon, Sun} from 'lucide-react';
import {useScrollChrome} from '@/components/layout/useScrollChrome';
import {isIPhoneDevice, isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {ReaderTypography, readTypography, type Typography} from './ReaderTypography';
import {useReaderTheme} from './useReaderTheme';
import {BulletinEbook, bulletinChapters, bulletinChapterForAnchor, bulletinMobileDetails, Button, ReaderWatermark} from '@hallelujahhomechurch/ui';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import type {OnlineBulletinAccess, BulletinReaderMutation, BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import type {BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';
import {useAccountAuth, useAccountIdentity, useAccountSignIn, useBulletinAccess, useBulletinAuthorization} from '@/components/layout/AccountControl';
import {createReaderApi, verifyReaderAccess, type ReaderSelector} from '@/features/weekly-reader/api';
import {keyboardPageDelta, pageScale, sourcePageStart, sourcePageForSentence, swipeDirection, type ReaderZoom} from '@/features/weekly-reader/navigation';
import {fitPaperLines} from '@/features/weekly-reader/paper-lines';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';
import {getOfflineIdentity, supportsOfflineReader} from '@/features/weekly-reader/offline-store';
import {watchOfflineAccount} from '@/features/weekly-reader/offline-session';
import {useReaderSession} from '@/features/weekly-reader/useReaderSession';
import {usePrivateReader} from '@/features/weekly-reader/usePrivateReader';
import {readerSentences} from '@/features/weekly-reader/selection';
import {rangeQuote, renderedTextRanges, type ReaderTextRange} from '@/features/weekly-reader/text-range';
import {selectedHighlight} from '@/features/weekly-reader/highlight-selection';
import {useTextSelection} from '@/features/weekly-reader/useTextSelection';
import {copySentences, copyTextRanges} from '@/features/weekly-reader/copy';
import {RangeHighlights} from './RangeHighlights';
import {useReaderProgress} from '@/features/weekly-reader/progress';
import {NoteIndicators} from './NoteIndicators';
import {readReaderReturn, saveReaderReturn} from '@/features/weekly-reader/return-state';
import type {Locale} from '@/i18n/locales';
import {ReaderToolbar, type ReaderMessages} from './ReaderToolbar';
import {PageNavigator} from './PageNavigator';
import {ReaderTabs} from './ReaderTabs';
import {PaperViewport, type ReadingDirection} from './PaperViewport';
import {usePaperGestures} from '@/features/weekly-reader/usePaperGestures';
import {readPaperView, writePaperView} from '@/features/weekly-reader/workspace';
import {SectionNavigator} from './SectionNavigator';
import {ChapterPull} from './ChapterPull';
import {ReaderSearch} from './ReaderSearch';
import {OfflineControl} from './OfflineControl';
import {SelectionToolbar} from './SelectionToolbar';
import {NoteEditor, type NoteSave, type NoteEditorState} from './NoteEditor';
import {NotesPanel} from './NotesPanel';
import {NoteReanchor} from './NoteReanchor';
import {HighlightsPanel} from './HighlightsPanel';
import {HighlightHistory} from './HighlightHistory';
import {ReaderPrivateState} from './ReaderPrivateState';
import {ReaderRecovery} from './ReaderRecovery';
import '@hallelujahhomechurch/ui/bulletin-paper.css';
import '@hallelujahhomechurch/ui/bulletin-paper-v2.css';
import '@hallelujahhomechurch/ui/bulletin-ebook.css';
import './reader.css';

type Props = {locale: Locale; issueNumber: number; series: BulletinSeries; contentLocale: BulletinLocale; messages: ReaderMessages};
const subscribeStandalone = () => () => undefined;
const iphoneStandaloneSnapshot = () => isIPhoneDevice() && isStandaloneWebApp();
const serverStandaloneSnapshot = () => false;
type Anchor = {kind: 'component' | 'sentence'; id: string};
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
  return <main className="weekly-reader" data-theme={readerTheme.theme} style={{colorScheme: readerTheme.theme}}>
    {!permitted && !(savedAccount && offlineAccount === savedAccount) ? <a className="reader-back" href={`/${props.locale}/literature-ministry`}>{m.back}</a> : null}
    {permitted || savedAccount && offlineAccount === savedAccount ? <AuthorizedReader key={`${savedAccount}:${props.issueNumber}:${props.series}:${props.contentLocale}`} {...props} accountId={savedAccount!} readerTheme={readerTheme}/> :
      <section className="reader-status" role="status"><h1>{m.title}</h1><p>{!enabled ? m.unavailable : auth.status === 'anonymous' ? m.signInRequired : auth.status === 'checking' || access.status === 'loading' ? m.loading : m.unavailable}</p>{enabled && auth.status === 'anonymous' ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}</section>}
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
  const guard = (event: React.SyntheticEvent) => {if (!session.allowAction()) {event.preventDefault(); event.stopPropagation();}};
  if (session.value) return <>
    {session.validating ? <p role="status">{m.loading}</p> : null}
    <div hidden={session.validating} inert={session.validating} onClickCapture={guard} onKeyDownCapture={guard} onPointerDownCapture={guard} onCopyCapture={guard}>
    {session.offline ? <p role="status">{m.offlineNotice}</p> : null}
    {session.loginRequired ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}
    <ReaderDocument readerTheme={props.readerTheme} key={`${session.value.document.documentId}:${session.value.document.revision}`} value={session.value} selector={selector} messages={m} api={api} offline={session.offline} allowAction={session.allowAction} onFailure={session.privateFailure} onUpdated={session.acceptSaved} suspended={!!session.validating} backHref={`/${props.locale}/literature-ministry`} offlineControl={<OfflineControl api={api} value={session.value} selector={selector} locale={props.locale} messages={m} onSaved={session.acceptSaved} onFailure={session.privateFailure}/>}/>
  </div></>;
  return <><ReaderTabs accountId={accountId} locale={props.locale} current={props} messages={m}/><section className="reader-status" role={session.error ? 'alert' : 'status'}><h1>{m.title}</h1><p>{session.error ? m[session.error] : m.loading}</p>{session.loginRequired ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}{session.error ? <button type="button" onClick={session.retry}>{m.retry}</button> : null}</section></>;
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
  const [notes, setNotes] = useState<'list' | 'new' | 'restore' | BulletinReaderNote | null>(returned?.draft ? returned.draft.noteId ? 'restore' : 'new' : null);
  const [noteFilter, setNoteFilter] = useState<string[] | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const {selection, selecting, setSelection, clear: clearSelection, clearIf} = useTextSelection(paperRef, sentences, {
    ids: returned?.revision === value.document.revision ? returned.selected.filter(id => sentences.some(sentence => sentence.id === id)) : [],
    ranges: returned?.revision === value.document.revision ? returned.selectedRanges : undefined
  }, !!notes || suspended);
  const selected = selection.ids;
  const selectionRanges = useMemo(() => selection.ranges ?? sentences.filter(sentence => selected.includes(sentence.id)).map(sentence => ({sentenceId: sentence.id, start: 0, end: [...sentence.text].length})), [selection.ranges, selected, sentences]);
  const savedHighlights = useMemo(() => privateReader.state?.highlights ?? [], [privateReader.state?.highlights]);
  const highlightSelection = selectedHighlight(selectionRanges, savedHighlights);
  const selectExisting = useCallback((range: ReaderTextRange) => {
    if (allowAction() && !notes && !suspended) setSelection({ids: [range.sentenceId], ranges: [range]});
  }, [allowAction, notes, suspended, setSelection]);
  const [noteEditorState, setNoteEditorState] = useState<NoteEditorState | undefined>(returned?.draft ? {draft: returned.draft, conflict: null} : undefined);
  const [deletion, setDeletion] = useState<{local: BulletinReaderNote; cloud?: BulletinReaderNote} | null>(null);
  const [reanchor, setReanchor] = useState<BulletinReaderNote | null>(null);
  const [wideNotes, setWideNotes] = useState(false);
  const documentRef = useRef<HTMLElement>(null);
  const noteButton = useRef<HTMLButtonElement>(null);
  const notesButton = useRef<HTMLButtonElement>(null);
  const newNoteId = useRef<string | null>(returned?.action?.kind === 'createNote' ? returned.action.payload.noteId : null);
  const highlights = Object.fromEntries(privateReader.state?.highlights.filter(highlight => highlight.active && !highlight.segments).map(highlight => [highlight.sentenceId, highlight.color]) ?? []);
  const sentenceState = Object.fromEntries(sentences.map(sentence => [sentence.id, {highlight: highlights[sentence.id]}]));
  const editingNote = typeof notes === 'object' && notes ? notes : notes === 'restore' ? privateReader.state?.notes.find(note => note.id === returned?.draft?.noteId) : undefined;
  const noteAnchors = editingNote ? editingNote.sentenceIds : selected;
  const noteQuote = editingNote ? editingNote.quote : selection.ranges ? rangeQuote(selection.ranges, sentences) : sentences.filter(sentence => selected.includes(sentence.id)).map(sentence => sentence.text).join('\n');
  function closeNotes() {
    if (privateReader.busy) return false;
    const original = editingNote?.text ?? '';
    if (notes && notes !== 'list' && noteEditorState && noteEditorState.draft.text !== original && !window.confirm(m.noteDiscardConfirm)) return false;
    setNotes(null); setDeletion(null); setReanchor(null); setNoteEditorState(undefined);
    requestAnimationFrame(() => (noteButton.current ?? notesButton.current)?.focus());
    return true;
  }
  function openNotesList(ids: string[] | null, trigger?: HTMLButtonElement) {
    if (notes && !closeNotes()) return;
    noteButton.current = trigger ?? null;
    setNoteFilter(ids); setNotes('list');
  }
  async function saveNote(draft: NoteSave) {
    const common = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision};
    newNoteId.current ??= crypto.randomUUID();
    const mutation: BulletinReaderMutation = draft.noteId && draft.baseVersion ? {...common, kind: 'editNote', baseVersion: draft.baseVersion, payload: {noteId: draft.noteId, text: draft.text}} : {...common, kind: 'createNote', payload: {noteId: newNoteId.current, sentenceIds: noteAnchors, text: draft.text, ...(selection.ranges ? {ranges: selection.ranges} : {})}};
    const result = await privateReader.mutate(mutation);
    if (result.status !== 'applied' && result.status !== 'queued' && result.status !== 'note_conflict') throw new Error(result.status);
    return {status: result.status, note: 'note' in result ? result.note : undefined};
  }
  async function action(mutation: BulletinReaderMutation) {
    const actedSelection = selection;
    try {
      const result = await privateReader.mutate(mutation);
      const saved = result.status === 'applied' || result.status === 'queued';
      setNotice(saved ? '' : m.syncAction);
      // An older response must not dismiss a selection made while it was pending.
      if (saved) clearIf(actedSelection);
    }
    catch {setNotice(m.actionFailed);}
  }
  async function deleteNote(note: BulletinReaderNote) {
    try {
      const result = await privateReader.mutate({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'deleteNote', baseVersion: note.version, payload: {noteId: note.id}});
      if (result.status === 'note_conflict') setDeletion({local: deletion?.local ?? note, cloud: result.note});
      else if (result.status === 'applied' || result.status === 'queued') {setDeletion(null); setNotes('list');}
      else setNotice(m.syncAction);
    } catch {setNotice(m.actionFailed);}
  }
  const storageKey = `weekly-reader-position:${selector.accountId}:${value.document.documentId}:${value.document.revision}`;
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
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
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
  const previousMobile = useRef(mobile);
  const chapterEdge = useRef<'top' | 'bottom' | null>(null);
  function openPanel(next: Exclude<typeof panel, null>, trigger: Element) {
    if (notes && !closeNotes()) return;
    revealChrome(); clearSelection(); panelTrigger.current = trigger instanceof HTMLElement ? trigger : null; setPanel(current => current === next ? null : next);
  }
  function closePanel(restoreFocus = true) {
    setPanel(null);
    if (restoreFocus) requestAnimationFrame(() => panelTrigger.current?.focus({preventScroll: true}));
  }
  useEffect(() => {
    if (!panel) return;
    chromeRef.current?.querySelector<HTMLElement>(panel === 'search' ? '.reader-search input' : '.reader-navigation-panel:not([hidden]) > header button')?.focus({preventScroll: true});
  }, [panel]);
  const productionSentenceIds = useMemo(() => bulletinMobileDetails(document).sentenceIds, [document]);
  const chapters = useMemo(() => bulletinChapters(document), [document]);
  const [chapter, setChapter] = useState(chapters[0]?.id ?? 'cover');
  const chapterIndex = chapters.findIndex(entry => entry.id === chapter);
  const hasNotes = privateReader.state?.notes.some(note => !note.deleted && (!mobile || note.ranges?.some(range => bulletinChapterForAnchor(document, {kind: 'sentence', id: range.sentenceId}) === chapter) || note.sentenceIds.some(id => bulletinChapterForAnchor(document, {kind: 'sentence', id}) === chapter))) ?? false;
  const chapterLabels = {cover: m.chapterCover, body: m.chapterBody, worship: m.chapterWorship, back: m.chapterBack};
  const chapterHeading = useRef<HTMLDivElement>(null);
  const [nativeZoomed, setNativeZoomed] = useState(false);
  const [fontsReady, setFontsReady] = useState(() => !globalThis.document?.fonts);
  const [viewport, setViewport] = useState({width: 900, height: 700});
  const viewportRef = useRef<HTMLDivElement>(null);
  const [typography, setTypography] = useState(readTypography);
  const iphoneStandalone = useSyncExternalStore(subscribeStandalone, iphoneStandaloneSnapshot, serverStandaloneSnapshot);
  const {visible: chromeVisible, reveal: revealChrome} = useScrollChrome({root: viewportRef, blocked: !mobile || !!panel || !!notes || selecting || selected.length > 0 || suspended});
  const readingInset = useCallback(() => Math.max(viewportRef.current?.getBoundingClientRect().top ?? 0, mobile && chromeVisible ? chromeRef.current?.querySelector('.reader-tabbar')?.getBoundingClientRect().bottom ?? 0 : 0) + 8, [mobile, chromeVisible]);
  function changeTypography(next: Typography) {
    const root = viewportRef.current;
    const anchor = Array.from(paperRef.current?.querySelectorAll<HTMLElement>('[data-sentence-id]') ?? []).find(node => node.getBoundingClientRect().bottom > readingInset());
    const top = anchor?.getBoundingClientRect().top;
    setTypography(next);
    try {localStorage.setItem('hhc-reader-typography', JSON.stringify(next));} catch { /* Optional local preference. */ }
    requestAnimationFrame(() => {if (root && anchor && top !== undefined) root.scrollTop += anchor.getBoundingClientRect().top - top;});
  }
  const {changeZoom, captureAnchor} = usePaperGestures({root: viewportRef, enabled: !mobile && !suspended, blocked: !!notes, zoom, setZoom, layoutKey: `${viewport.width}:${viewport.height}`});
  const preservePaperPosition = useEffectEvent(() => {if (resumeResolved && fontsReady && !mobile) captureAnchor();});
  const pendingAnchor = useRef<(Anchor & {focus: boolean}) | null>(null);
  const gesture = useRef<{x: number; y: number; multiplePointers: boolean} | null>(null);
  const pointers = useRef(new Set<number>());
  const active = document.pages[page];
  useLayoutEffect(() => {
    if (mobile || !fontsReady || !paperRef.current) return;
    const headers = new Set(document.components.flatMap(component => {
      const header = component.type === 'bodySection' ? component.bodySection.header : undefined;
      return header ? [header.lectureDate.id, ...header.contributors.map(credit => credit.name.id)] : [];
    }));
    const cover = document.components.find(component => component.type === 'cover')?.cover;
    return fitPaperLines(paperRef.current, headers, cover ? {worship: cover.worship.flatMap(item => item.blocks.map(block => block.id)), work: cover.work.flatMap(item => item.blocks.map(block => block.id))} : undefined);
  }, [document, active.id, mobile, fontsReady, viewport.width, viewport.height, zoom, hasNotes, direction]);
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
  const onPage = (next: number, record = true) => {
    if (!Number.isFinite(next) || record && notes && !closeNotes()) return false;
    revealChrome();
    setResumeResolved(true);
    if (record) clearSelection();
    pendingAnchor.current = null;
    try {sessionStorage.removeItem(`${storageKey}:anchor`);} catch { /* Optional restoration. */ }
    const target = Math.max(0, Math.min(document.pages.length - 1, Math.floor(next)));
    setPage(target);
    setPaperJump(value => value + 1);
    if (mobile) {
      setSourceJump({page: target, focus: record});
      const first = sourcePageStart(value.document.content, target, mobile ? productionSentenceIds : undefined);
      setChapter(first ? bulletinChapterForAnchor(document, {kind: 'sentence', id: first.sentenceId}) ?? chapters[0].id : chapters[0].id);

    }
    if (record) progress.record(document.pages[target].id);
    return true;
  };
  useEffect(() => {
    let active = true;
    void globalThis.document.fonts?.ready.then(() => {if (active) setFontsReady(true);});
    return () => {active = false;};
  }, []);
  useEffect(() => {
    const root = documentRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWideNotes((entries[0]?.contentRect.width ?? 0) >= 1068));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const visual = window.visualViewport;
    const changed = () => setNativeZoomed((visual?.scale ?? 1) > 1);
    changed(); visual?.addEventListener('resize', changed);
    return () => visual?.removeEventListener('resize', changed);
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const changed = () => setMobile(query.matches);
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
  }, [hasNotes]);
  const enterReflow = useEffectEvent(() => {
    const first = sourcePageStart(value.document.content, page, productionSentenceIds);
    setChapter(first ? bulletinChapterForAnchor(document, {kind: 'sentence', id: first.sentenceId}) ?? chapters[0].id : chapters[0].id);

    if (page > 0) setSourceJump({page, focus: false});
  });
  useEffect(() => {
    const frame = mobile && !previousMobile.current ? requestAnimationFrame(() => enterReflow()) : undefined;
    previousMobile.current = mobile;
    return () => {if (frame !== undefined) cancelAnimationFrame(frame);};
  }, [mobile]);
  useEffect(() => {
    if (!resumeResolved) return;
    try {sessionStorage.setItem(storageKey, active.id);} catch { /* Reading remains available without storage. */ }
  }, [active.id, storageKey, resumeResolved]);
  const scrollToPage = useEffectEvent(() => {
    const viewport = viewportRef.current;
    if (!viewport || !fontsReady || !resumeResolved) return;
    if (mobile) {
      if (chapterEdge.current) {
        // Imperative scrolling of a DOM element, not a React state mutation.
        viewport.scrollTop = chapterEdge.current === 'bottom' ? viewport.scrollHeight : 0;
        chapterEdge.current = null; pendingAnchor.current = null;
        chapterHeading.current?.focus({preventScroll: true});
        return;
      }
      const anchor = pendingAnchor.current;
      if (anchor) {
        const attribute = `data-${anchor.kind}-id`;
        const element = Array.from(viewport.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(element => element.getAttribute(attribute) === anchor.id);
        if (element) {
          // Imperative DOM scrolling; this does not mutate React state or the ref itself.
          viewport.scrollTop += element.getBoundingClientRect().top - readingInset();
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
        destination.scrollIntoView({block: 'start'});
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
  }, [paperJump, direction, mobile, fontsReady, resumeResolved, chapter]);
  function recordVisiblePaper() {
    const root = viewportRef.current;
    if (!root || mobile || direction !== 'vertical' || !resumeResolved || !fontsReady || suspended || notes || !allowAction()) return;
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
  const observePaperPage = useEffectEvent(recordVisiblePaper);
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || mobile || direction !== 'vertical') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scroll = () => {clearTimeout(timer); timer = setTimeout(() => {timer = undefined; observePaperPage();}, 150);};
    const hide = () => {
      if (globalThis.document.visibilityState !== 'hidden' || timer === undefined) return;
      clearTimeout(timer); timer = undefined; observePaperPage(); void flushProgress();
    };
    root.addEventListener('scroll', scroll, {passive: true});
    globalThis.document.addEventListener('visibilitychange', hide);
    return () => {clearTimeout(timer); root.removeEventListener('scroll', scroll); globalThis.document.removeEventListener('visibilitychange', hide);};
  }, [mobile, direction, flushProgress]);
  useEffect(() => {
    if (!mobile || !fontsReady || !sourceJump) return;
    const target = sourceJump.page;
    const first = sourcePageStart(value.document.content, target, mobile ? productionSentenceIds : undefined);
    const frame = requestAnimationFrame(() => {
      if (!paperRef.current) return;
      setSourceJump(null);
      const rect = target === 0 ? paperRef.current.getBoundingClientRect() : first && renderedTextRanges(paperRef.current, first)[0]?.getBoundingClientRect();
      if (rect && viewportRef.current) viewportRef.current.scrollTop += rect.top - readingInset();
      const destination = first ? Array.from(paperRef.current.querySelectorAll<HTMLElement>('[data-sentence-id]')).find(element => element.dataset.sentenceId === first.sentenceId) : chapterHeading.current;
      if (destination && sourceJump.focus) {destination.tabIndex = -1; destination.focus({preventScroll: true});}
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceJump, mobile, fontsReady, value.document.content, chapter, productionSentenceIds, readingInset]);
  useEffect(() => {
    if (!mobile || !fontsReady || notes) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = () => {
      timer = undefined;
      if (!allowAction()) return;
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
  }, [mobile, fontsReady, notes, allowAction, value.document, storageKey, recordProgress, flushProgress, chapter, readingInset]);
  function onAnchor(anchor: Anchor, record = true, preferredPage?: number) {
    const matches = document.layoutManifest.pages.filter(layout => layout.slots.some(slot => anchor.kind === 'component' ? slot.componentId === anchor.id : slot.fragments.some(fragment => fragment.sentenceId === anchor.id)) || anchor.kind === 'sentence' && layout.fixedSlots?.some(slot => `canonical-${slot.element}` === anchor.id));
    const layout = matches.find(layout => layout.pageId === document.pages[preferredPage ?? -1]?.id) ?? matches[0];
    const index = document.pages.findIndex(page => page.id === layout?.pageId);
    if (index < 0) return;
    if (!onPage(index, record)) return;
    if (mobile && anchor.kind === 'sentence' && productionSentenceIds.has(anchor.id)) return;
    const targetChapter = bulletinChapterForAnchor(document, anchor);
    if (targetChapter) setChapter(targetChapter);
    setSourceJump(null);
    if (record && anchor.kind === 'sentence') progress.record(document.pages[index].id, anchor.id);
    pendingAnchor.current = {...anchor, focus: record};
    try {sessionStorage.setItem(`${storageKey}:anchor`, JSON.stringify(anchor));} catch { /* Optional restoration. */ }
    if (!mobile && index === page) {
      const attribute = `data-${anchor.kind}-id`;
      Array.from(viewportRef.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id)?.scrollIntoView({block: 'start'});
    }
  }
  function onChapter(index: number, restore = false) {
    const target = chapters[index];
    if (!target || !allowAction() || suspended || notes && !closeNotes()) return;
    onAnchor({kind: 'component', id: target.componentIds[0]});
    chapterEdge.current = restore ? 'bottom' : 'top';
  }
  const restorePosition = useEffectEvent(() => {
    // Restore once, without rewriting progress or letting late sync undo navigation.
    if (resumeResolved || suspended) return;
    const local = restoredPage >= 0 || !!restoredAnchor;
    const target = local ? Math.max(0, restoredPage) : Math.max(0, document.pages.findIndex(page => page.id === cloudProgress?.pageId));
    const anchor = local ? restoredAnchor : cloudProgress?.sentenceId ? {kind: 'sentence' as const, id: cloudProgress.sentenceId} : cloudProgress?.componentId ? {kind: 'component' as const, id: cloudProgress.componentId} : null;
    if (!onPage(target, false)) return;
    if (anchor) onAnchor(anchor, false, target);
  });
  useEffect(() => {
    if (resumeResolved || !fontsReady || suspended) return;
    if (restoredPage < 0 && !restoredAnchor && !privateReader.state && privateReader.status === 'syncing') return;
    // Anchor scrolling needs the font-ready page's completed layout.
    const frame = requestAnimationFrame(() => restorePosition());
    return () => cancelAnimationFrame(frame);
  }, [resumeResolved, fontsReady, suspended, restoredPage, restoredAnchor, privateReader.state, privateReader.status]);
  return <section ref={documentRef} className="reader-document" data-mobile={mobile || undefined} data-mobile-hidden={!chromeVisible} data-iphone-standalone={iphoneStandalone || undefined} data-panel-open={!!panel || undefined} data-notes-panel={notes && wideNotes || undefined} aria-label={m.title} role="region" onKeyDown={event => {
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
    if (!mobile && (event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key) && !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))) {
      event.preventDefault(); changeZoom(zoom + (event.key === '-' ? -.25 : .25)); return;
    }
    const delta = keyboardPageDelta(event, !!window.getSelection()?.toString());
    if (!mobile && direction === 'horizontal' && delta) {event.preventDefault(); onPage(page + delta);}
  }}>
    <div ref={chromeRef} className="reader-chrome">
      <div className="reader-chrome-controls" inert={!!panel}>
      <ReaderTabs accountId={selector.accountId} locale={backHref.split('/')[1] as Locale} current={selector} title={value.document.canonicalMetadata.title} messages={m} beforeNavigate={async () => {
        if (!allowAction() || privateReader.busy || notes && !closeNotes()) return false;
        recordVisiblePaper();
        await flushProgress();
        return allowAction();
      }} search={<IconButton variant="ghost" aria-label={m.search} title={m.search} aria-expanded={panel === 'search'} onPress={event => openPanel('search', event.target)} icon={<Search size={20} aria-hidden="true"/>}/>}/>
      <header className={mobile ? "reader-topbar site-mobile-tab-bar" : "reader-topbar"} data-mobile-hidden={!chromeVisible} data-iphone-standalone={iphoneStandalone || undefined} aria-label={m.title}>
        <IconButton variant="ghost" aria-label={mobile ? m.contents : m.thumbnails} title={mobile ? m.contents : m.thumbnails} aria-expanded={panel === 'pages'} onPress={event => openPanel('pages', event.target)} icon={<PanelLeft size={20} aria-hidden="true"/>}/>
        {mobile ? <IconButton variant="ghost" aria-label={m.typography} aria-expanded={panel === 'type'} onPress={event => openPanel('type', event.target)} icon={<ALargeSmall size={20} aria-hidden="true"/>}/> : null}
        <IconButton variant="ghost" aria-label={theme === 'dark' ? m.lightMode : m.darkMode} title={theme === 'dark' ? m.lightMode : m.darkMode} aria-pressed={theme === 'dark'} onPress={toggleTheme} icon={theme === 'dark' ? <Sun size={20} aria-hidden="true"/> : <Moon size={20} aria-hidden="true"/>}/>
        <IconButton buttonRef={notesButton} variant="ghost" aria-label={m.myNotes} aria-description={m.savedHighlights} title={m.myNotes} isDisabled={!privateReader.state} onPress={() => {revealChrome(); setPanel(null); openNotesList(null);}} icon={<NotebookPen size={20} aria-hidden="true"/>}/>
        {offlineControl}
        {!mobile ? <ReaderToolbar messages={m} zoom={zoom} setZoom={changeZoom}/> : null}
        {!mobile ? <div className="reader-direction-controls" role="group" aria-label={m.readingDirection}>
          <IconButton variant="ghost" aria-label={`${m.readingDirection}: ${m[direction]}`} title={`${m[direction]} → ${m[direction === 'vertical' ? 'horizontal' : 'vertical']}`} aria-pressed={direction === 'horizontal'} onPress={() => {if (notes && !closeNotes()) return; clearSelection(); setPanel(null); setDirection(current => current === 'vertical' ? 'horizontal' : 'vertical');}} icon={direction === 'vertical' ? <ChevronsUpDown size={20} aria-hidden="true"/> : <ChevronsLeftRight size={20} aria-hidden="true"/>}/>
        </div> : null}
      </header>
      </div>
      {panel ? <div className="reader-panel-backdrop" data-clear={panel === 'type' || undefined} aria-hidden="true" onClick={() => closePanel()}/> : null}
      <aside className="reader-navigation-panel" role="dialog" aria-modal="true" data-panel={panel} hidden={!panel || panel === 'search'} aria-label={panel === 'pages' ? mobile ? m.contents : m.thumbnails : m.typography}>
        <header><h2>{panel === 'pages' ? mobile ? m.contents : m.thumbnails : m.typography}</h2><IconButton variant="ghost" aria-label={m.close} onPress={() => closePanel()} icon={<X size={20} aria-hidden="true"/>}/></header>
        {panel === 'pages' ? <>
          {mobile ? <nav className="reader-chapters" aria-label={m.chapters}>{chapters.map((entry, index) => <Button key={entry.id} variant="ghost" aria-current={entry.id === chapter ? 'location' : undefined} onPress={() => {onChapter(index); closePanel(false);}}>{chapterLabels[entry.id]}</Button>)}</nav> : null}
          {mobile ? <details className="reader-original-pages"><summary>{m.originalPages}</summary><PageNavigator document={document} metadata={value.document.canonicalMetadata} traceCode={value.access.traceCode} theme={theme} page={page} onPage={target => {if (onPage(target)) closePanel(false);}} messages={m}/></details> : <PageNavigator document={document} metadata={value.document.canonicalMetadata} traceCode={value.access.traceCode} theme={theme} page={page} onPage={target => {if (onPage(target)) closePanel();}} messages={m}/>}
          <SectionNavigator document={document} onSection={id => {onAnchor({kind: 'component', id}); closePanel(!mobile);}} messages={m}/>
        </> : null}
        {panel === 'type' ? <ReaderTypography value={typography} onChange={changeTypography} messages={m}/> : null}
      </aside>
      <aside className="reader-navigation-panel reader-search-panel" role="dialog" aria-modal="true" data-panel="search" hidden={panel !== 'search'} aria-label={m.search}>
        <header><IconButton variant="ghost" aria-label={m.close} onPress={() => closePanel()} icon={<ChevronLeft size={22} aria-hidden="true"/>}/></header>
        <ReaderSearch document={value.document} mobile={mobile} onJump={id => {onAnchor({kind: 'sentence', id}); closePanel(false);}} messages={m}/>
      </aside>
    </div>
    {value.document.metadataSyncPending ? <p role="status">{m.metadataPending}</p> : null}
    {!privateReader.busy && (privateReader.status === 'paused' || privateReader.status === 'action' || privateReader.pendingMutation) ? <ReaderRecovery api={api} value={value} selector={selector} messages={m} onUpdated={onUpdated} onFailure={onFailure} suspended={suspended} pendingMutation={privateReader.pendingMutation} onPendingChange={mutation => {
      const previous = privateReader.pendingMutation;
      privateReader.replacePending(mutation);
      if (!mutation && previous && ['createNote', 'editNote', 'deleteNote', 'reanchorNote'].includes(previous.kind)) {setNotes(null); setReanchor(null); setNoteEditorState(undefined); if (previous.kind === 'createNote') clearSelection();}
    }}/> : null}
    {!privateReader.busy && privateReader.canRetry && privateReader.status !== 'paused' ? <><p>{m.confirmRetryHelp}</p><button type="button" disabled={privateReader.busy} onClick={() => {
      const snapshot = selection, kind = privateReader.pendingMutation?.kind;
      void privateReader.retry().then(result => {
      if (result?.status === 'note_conflict' && noteEditorState) setNoteEditorState({...noteEditorState, conflict: {status: 'note_conflict', note: result.note}});
      else if (result?.status === 'applied') {
        if (kind === 'createNote' || kind === 'editNote' || kind === 'deleteNote' || kind === 'reanchorNote') {setNotes(null); setReanchor(null); setNoteEditorState(undefined);}
        if (kind === 'createNote' || kind === 'setHighlight' || kind === 'clearHighlight') clearIf(snapshot);
      }
    }).catch(() => setNotice(m.actionFailed));
    }}>{m.confirmRetry}</button></> : null}
    <div className="reader-stage" inert={!!panel}>
    <div ref={viewportRef} className="reader-viewport" data-mobile={mobile || undefined} data-direction={mobile ? undefined : direction} data-active-page={active.id} style={{touchAction: mobile || notes || nativeZoomed ? 'auto' : direction === 'horizontal' && !zoomed ? 'pan-y' : 'pan-x pan-y'}} tabIndex={0} onPointerDown={event => {
      if (event.pointerType !== 'touch' || notes || mobile || suspended) return;
      pointers.current.add(event.pointerId);
      if (!gesture.current) gesture.current = {x: event.clientX, y: event.clientY, multiplePointers: false};
      if (pointers.current.size > 1) gesture.current.multiplePointers = true;
    }} onPointerCancel={() => {pointers.current.clear(); gesture.current = null;}} onPointerUp={event => {
      pointers.current.delete(event.pointerId);
      const start = gesture.current;
      if (!start || pointers.current.size) return;
      gesture.current = null;
      const delta = swipeDirection({...start, dx: event.clientX - start.x, dy: event.clientY - start.y, zoomed: zoomed || (window.visualViewport?.scale ?? 1) > 1, hasSelection: !!window.getSelection()?.toString()});
      if (!mobile && direction === 'horizontal' && delta) onPage(page + delta);
    }}>
      {mobile && chapterIndex > 0 ? <div className="reader-chapter-boundary"><IconButton variant="ghost" aria-label={m.previous} isDisabled={suspended} onPress={() => onChapter(chapterIndex - 1, true)} icon={<ArrowUp size={20} aria-hidden="true"/>}/></div> : null}
      {!fontsReady ? <p role="status">{m.loading}</p> : null}
      <div ref={paperRef} className="reader-paper-with-notes" data-has-notes={hasNotes || undefined} aria-hidden={!fontsReady || undefined} style={{visibility: fontsReady ? 'visible' : 'hidden', width: mobile ? undefined : Math.max(...document.pages.map(entry => entry.width * 4 / 3 * pageScale(zoom, {width: entry.width * 4 / 3, height: entry.height * 4 / 3}, viewport))) + (hasNotes ? 44 : 0)}}>
      {mobile ? <div ref={chapterHeading} tabIndex={-1} role="group" aria-label={chapterLabels[chapter]} className="reader-watermarked" style={{"--reader-font-size": `${typography.size}px`, "--reader-line-height": typography.line} as React.CSSProperties}><BulletinEbook document={document} chapter={chapter} canonicalMetadata={value.document.canonicalMetadata} sentenceState={sentenceState}/><ReaderWatermark traceCode={value.access.traceCode} tone={theme}/></div> :
        <PaperViewport document={document} metadata={value.document.canonicalMetadata} sentenceState={sentenceState} traceCode={value.access.traceCode} theme={theme} page={page} direction={direction} zoom={zoom} viewport={viewport}/>}
      <NoteIndicators root={paperRef} notes={privateReader.state?.notes ?? []} layoutKey={`${active.id}:${mobile}:${scale}:${fontsReady}:${typography.size}:${typography.line}:${direction}:${chapter}`} label={m.myNotes} onOpen={openNotesList}/>
      <RangeHighlights root={paperRef} highlights={savedHighlights} layoutKey={`${active.id}:${mobile}:${scale}:${fontsReady}:${typography.size}:${typography.line}:${direction}:${chapter}`} onSelect={selectExisting}/>
      </div>
      {mobile && chapterIndex < chapters.length - 1 ? <div className="reader-chapter-boundary"><IconButton variant="ghost" aria-label={m.next} isDisabled={suspended} onPress={() => onChapter(chapterIndex + 1)} icon={<ArrowDown size={20} aria-hidden="true"/>}/></div> : null}
      {mobile ? <ChapterPull key={chapter} root={viewportRef} blocked={!!panel || selecting || selected.length > 0 || !!notes || suspended || nativeZoomed} onPrevious={chapterIndex > 0 ? () => onChapter(chapterIndex - 1, true) : undefined} onNext={chapterIndex < chapters.length - 1 ? () => onChapter(chapterIndex + 1) : undefined}/> : null}
    </div>
    </div>
    {!mobile && direction === 'horizontal' ? <div className="reader-page-controls" role="group" aria-label={m.originalPages}>
      {page > 0 ? <IconButton variant="ghost" aria-label={m.previous} title={m.previous} isDisabled={suspended || page === 0} onPress={() => onPage(page - 1)} icon={<ChevronLeft size={20} aria-hidden="true"/>}/> : null}
      {page < document.pages.length - 1 ? <IconButton variant="ghost" aria-label={m.next} title={m.next} isDisabled={suspended || page >= document.pages.length - 1} onPress={() => onPage(page + 1)} icon={<ChevronRight size={20} aria-hidden="true"/>}/> : null}
    </div> : null}
    {notice ? <p className="reader-action-notice" role="status">{notice}</p> : null}
    <SelectionToolbar messages={m} root={paperRef} ranges={selectionRanges} count={selecting ? 0 : selectionRanges.reduce((count, range) => count + range.end - range.start, 0)} color={highlightSelection.color} clearable={highlightSelection.clearable} busy={privateReader.busy || !privateReader.state || privateReader.status === 'paused'} noteOpen={!!notes} noteButtonRef={noteButton}
      onColor={color => void action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'setHighlight', payload: {sentenceIds: selected, color, ...(selection.ranges ? {ranges: selection.ranges} : {})}})}
      onClear={() => void action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'clearHighlight', payload: {sentenceIds: selected, ...(selection.ranges ? {ranges: selection.ranges} : {})}})}
      onCopy={() => {const snapshot = selection; void (selection.ranges ? copyTextRanges(value.document, selection.ranges, allowAction) : copySentences(value.document, selected, allowAction)).then(() => {setNotice(m.copySuccess); clearIf(snapshot);}).catch(() => setNotice(m.copyFailed));}}
      onNote={() => {newNoteId.current = null; setNoteEditorState(undefined); setNotes('new');}}/>
    {notes ? <ReaderPrivateState wide={wideNotes} theme={theme} messages={m} onClose={closeNotes} suspended={suspended}>
      {reanchor ? <NoteReanchor key={reanchor.id} note={reanchor} document={value.document} messages={m} suspended={suspended} onSave={async (note, ranges) => {
        const result = await privateReader.mutate({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'reanchorNote', baseVersion: note.version, payload: {noteId: note.id, sentenceIds: ranges.map(range => range.sentenceId), ranges}});
        if (result.status !== 'applied' && result.status !== 'queued' && result.status !== 'note_conflict') throw new Error(result.status);
        return {status: result.status, note: 'note' in result ? result.note : undefined};
      }} onComplete={() => setReanchor(null)} onCancel={() => setReanchor(null)}/> : deletion ? <section className="reader-note-editor"><p role="alert">{m.noteConflict}</p><h3>{m.recoveryLocal}</h3><blockquote>{deletion.local.text}</blockquote><h3>{m.recoveryCloud}</h3><blockquote>{deletion.cloud && !deletion.cloud.deleted ? deletion.cloud.text : m.noteDeleted}</blockquote><div className="reader-note-actions">
        <button type="button" disabled={privateReader.busy} onClick={() => setDeletion(null)}>{m.noteCloud}</button>
        {deletion.cloud && !deletion.cloud.deleted ? <><button type="button" disabled={privateReader.busy} onClick={() => {if (window.confirm(m.noteDeleteConfirm)) void deleteNote(deletion.cloud!);}}>{m.noteDelete}</button><button type="button" disabled={privateReader.busy} onClick={() => {setNotes({...deletion.cloud!, text: `${deletion.cloud!.text}\n\n${deletion.local.text}`}); setDeletion(null);}}>{m.noteManual}</button></> : null}
      </div></section> : notes === 'list' ? <>
      {notice ? <p role="status">{notice}</p> : null}
      {!noteFilter ? <HighlightsPanel highlights={savedHighlights} sentences={sentences} messages={m} busy={privateReader.busy || !privateReader.state || privateReader.status === 'paused' || suspended} onChange={(range, color) => action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, ...(color ? {kind: 'setHighlight' as const, payload: {sentenceIds: [range.sentenceId], ranges: [range], color}} : {kind: 'clearHighlight' as const, payload: {sentenceIds: [range.sentenceId], ranges: [range]}})})}/> : null}
      {!noteFilter ? <HighlightHistory history={privateReader.state?.highlightHistory} document={value.document} messages={m} busy={privateReader.busy || !privateReader.state || privateReader.status === 'paused' || suspended} onSave={async mutation => {
        const result = await privateReader.mutate(mutation);
        if (result.status !== 'applied' && result.status !== 'queued') throw new Error(result.status);
      }}/> : null}
      <NotesPanel messages={m} notes={(privateReader.state?.notes ?? []).filter(note => !noteFilter || noteFilter.includes(note.id))} onReanchor={setReanchor} onJump={id => onAnchor({kind: 'sentence', id})} onEdit={note => {newNoteId.current = null; setNoteEditorState(undefined); setNotes(note);}} onDelete={note => {
        if (window.confirm(m.noteDeleteConfirm)) void deleteNote(note);
      }}/></> : notes === 'restore' && (!editingNote || editingNote.deleted) ? <section className="reader-note-editor">
        <p role="status">{!privateReader.state ? m.loading : m.noteDeleted}</p>
        <textarea aria-label={m.noteText} readOnly rows={8} value={noteEditorState?.draft.text ?? ''}/>
        <button type="button" onClick={closeNotes}>{m.noteCancel}</button>
      </section> : <NoteEditor key={editingNote?.id ?? 'new'} messages={m} note={editingNote} quote={noteQuote} editorState={noteEditorState} onEditorStateChange={setNoteEditorState} onSave={saveNote} onComplete={() => {if (notes === 'new') clearSelection(); setNotes(null); setNoteEditorState(undefined); requestAnimationFrame(() => notesButton.current?.focus());}} onCancel={closeNotes}/>}
    </ReaderPrivateState> : null}
  </section>;
}
