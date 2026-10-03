'use client';

import {useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Search, StickyNote, Download, Info, X, ChevronsUpDown, ChevronsLeftRight, ChevronLeft, ChevronRight, PanelLeft} from 'lucide-react';
import {Button, BulletinDocumentRenderer, ReaderWatermark} from '@hallelujahhomechurch/ui';
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
import {ReaderSearch} from './ReaderSearch';
import {OfflineControl} from './OfflineControl';
import {SelectionToolbar} from './SelectionToolbar';
import {NoteEditor, type NoteSave, type NoteEditorState} from './NoteEditor';
import {NotesPanel} from './NotesPanel';
import {ReaderPrivateState, SyncStatus} from './ReaderPrivateState';
import {ReaderRecovery} from './ReaderRecovery';
import '@hallelujahhomechurch/ui/bulletin-paper.css';
import './reader.css';

type Props = {locale: Locale; issueNumber: number; series: BulletinSeries; contentLocale: BulletinLocale; messages: ReaderMessages};
type Anchor = {kind: 'component' | 'sentence'; id: string};
export function WeeklyReader(props: Props) {
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
  return <main className="weekly-reader">
    {!permitted && !(savedAccount && offlineAccount === savedAccount) ? <a className="reader-back" href={`/${props.locale}/literature-ministry`}>{m.back}</a> : null}
    {permitted || savedAccount && offlineAccount === savedAccount ? <AuthorizedReader key={`${savedAccount}:${props.issueNumber}:${props.series}:${props.contentLocale}`} {...props} accountId={savedAccount!}/> :
      <section className="reader-status" role="status"><h1>{m.title}</h1><p>{!enabled ? m.unavailable : auth.status === 'anonymous' ? m.signInRequired : auth.status === 'checking' || access.status === 'loading' ? m.loading : m.unavailable}</p>{enabled && auth.status === 'anonymous' ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}</section>}
  </main>;
}

function AuthorizedReader(props: Props & {accountId: string}) {
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
    <ReaderDocument key={`${session.value.document.documentId}:${session.value.document.revision}`} value={session.value} selector={selector} messages={m} api={api} offline={session.offline} allowAction={session.allowAction} onFailure={session.privateFailure} onUpdated={session.acceptSaved} suspended={!!session.validating} backHref={`/${props.locale}/literature-ministry`} offlineControl={<OfflineControl api={api} value={session.value} selector={selector} locale={props.locale} messages={m} onSaved={session.acceptSaved} onFailure={session.privateFailure}/>}/>
  </div></>;
  return <><ReaderTabs accountId={accountId} locale={props.locale} current={props} messages={m}/><section className="reader-status" role={session.error ? 'alert' : 'status'}><h1>{m.title}</h1><p>{session.error ? m[session.error] : m.loading}</p>{session.loginRequired ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}{session.error ? <button type="button" onClick={session.retry}>{m.retry}</button> : null}</section></>;
}

function ReaderDocument({value, selector, messages: m, api, offline, allowAction, onFailure, onUpdated, suspended, backHref, offlineControl}: {value: OnlineBulletinAccess; selector: ReaderSelector; messages: ReaderMessages; api: ReturnType<typeof createReaderApi>; offline: boolean; allowAction: () => boolean; onFailure: (error: unknown) => void; onUpdated: (value: OnlineBulletinAccess) => void; suspended: boolean; backHref: string; offlineControl: ReactNode}) {
  const [returned] = useState(() => readReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}));
  const document = useMemo(() => verifyReaderAccess(value, selector), [value, selector]);
  const privateReader = usePrivateReader({api, selector, value, offline, allowAction, onFailure});
  const hasNotes = privateReader.state?.notes.some(note => !note.deleted) ?? false;
  const progress = useReaderProgress(value.document, privateReader.mutate);
  const recordProgress = progress.record;
  const flushProgress = progress.flush;
  const syncStatus = privateReader.busy ? 'syncing' : privateReader.canRetry ? 'action' : privateReader.status;
  const sentences = useMemo(() => readerSentences(value.document), [value.document]);
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<'list' | 'new' | BulletinReaderNote | null>(returned?.draft ? 'new' : null);
  const [noteFilter, setNoteFilter] = useState<string[] | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const {selection, setSelection, clear: clearSelection, clearIf} = useTextSelection(paperRef, sentences, {
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
  const [wideNotes, setWideNotes] = useState(false);
  const documentRef = useRef<HTMLElement>(null);
  const noteButton = useRef<HTMLButtonElement>(null);
  const notesButton = useRef<HTMLButtonElement>(null);
  const newNoteId = useRef<string | null>(returned?.action?.kind === 'createNote' ? returned.action.payload.noteId : null);
  const highlights = Object.fromEntries(privateReader.state?.highlights.filter(highlight => highlight.active && !highlight.segments).map(highlight => [highlight.sentenceId, highlight.color]) ?? []);
  const sentenceState = Object.fromEntries(sentences.map(sentence => [sentence.id, {highlight: highlights[sentence.id]}]));
  const noteAnchors = typeof notes === 'object' && notes ? notes.sentenceIds : selected;
  const noteQuote = typeof notes === 'object' && notes ? notes.quote : selection.ranges ? rangeQuote(selection.ranges, sentences) : sentences.filter(sentence => selected.includes(sentence.id)).map(sentence => sentence.text).join('\n');
  function closeNotes() {
    if (privateReader.busy) return false;
    const original = typeof notes === 'object' && notes ? notes.text : '';
    if (notes && notes !== 'list' && noteEditorState && noteEditorState.draft.text !== original && !window.confirm(m.noteDiscardConfirm)) return false;
    setNotes(null); setDeletion(null); setNoteEditorState(undefined);
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
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState<'pages' | 'search' | 'offline' | 'direction' | 'sync' | null>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const [sourceJump, setSourceJump] = useState<{page: number} | null>(null);
  const previousMobile = useRef(false);
  function openPanel(next: Exclude<typeof panel, null>, trigger: Element) {
    if (notes && !closeNotes()) return;
    clearSelection(); panelTrigger.current = trigger instanceof HTMLElement ? trigger : null; setPanel(current => current === next ? null : next);
  }
  function closePanel() {setPanel(null); panelTrigger.current?.focus();}
  useEffect(() => {
    if (!panel) return;
    chromeRef.current?.querySelector<HTMLElement>(panel === 'search' ? '.reader-search input' : '.reader-navigation-panel > header button')?.focus();
    const dismiss = (event: PointerEvent) => {if (event.target instanceof Node && !chromeRef.current?.contains(event.target)) setPanel(null);};
    globalThis.document.addEventListener('pointerdown', dismiss);
    return () => globalThis.document.removeEventListener('pointerdown', dismiss);
  }, [panel]);
  const [showProductionDetails, setShowProductionDetails] = useState(false);
  const productionSentenceIds = useMemo(() => new Set(document.components.flatMap(component => {
    const header = component.type === 'bodySection' ? component.bodySection.header : undefined;
    return header ? [header.lectureDate, ...header.contributors.map(contributor => contributor.name)].flatMap(block => block.sentences.map(sentence => sentence.id)) : [];
  })), [document]);
  // Presentation only: canonical text, saved anchors and the immutable paper renderer remain unchanged.
  const mobileDocument = useMemo(() => showProductionDetails ? document : {...document, components: document.components.map(component => component.type === 'bodySection' && component.bodySection.header ? {...component, bodySection: {...component.bodySection, header: undefined}} : component)}, [document, showProductionDetails]);
  const [nativeZoomed, setNativeZoomed] = useState(false);
  const [fontsReady, setFontsReady] = useState(() => !globalThis.document?.fonts);
  const [viewport, setViewport] = useState({width: 900, height: 700});
  const viewportRef = useRef<HTMLDivElement>(null);
  const {changeZoom, captureAnchor} = usePaperGestures({root: viewportRef, enabled: !mobile && !suspended, blocked: !!notes, zoom, setZoom, layoutKey: `${viewport.width}:${viewport.height}`});
  const preservePaperPosition = useEffectEvent(() => {if (resumeResolved && fontsReady && !mobile) captureAnchor();});
  const pendingAnchor = useRef<Anchor | null>(null);
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
    setResumeResolved(true);
    if (record) clearSelection();
    pendingAnchor.current = null;
    try {sessionStorage.removeItem(`${storageKey}:anchor`);} catch { /* Optional restoration. */ }
    const target = Math.max(0, Math.min(document.pages.length - 1, Math.floor(next)));
    setPage(target);
    setPaperJump(value => value + 1);
    if (mobile) {
      setSourceJump({page: target});
      const first = sourcePageStart(value.document.content, target);
      if (first && productionSentenceIds.has(first.sentenceId)) setShowProductionDetails(true);
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
  useEffect(() => {
    if (mobile && !previousMobile.current && page > 0) setSourceJump({page});
    previousMobile.current = mobile;
  }, [mobile, page]);
  useEffect(() => {
    if (!resumeResolved) return;
    try {sessionStorage.setItem(storageKey, active.id);} catch { /* Reading remains available without storage. */ }
  }, [active.id, storageKey, resumeResolved]);
  const scrollToPage = useEffectEvent(() => {
    const viewport = viewportRef.current;
    if (!viewport || mobile || !fontsReady || !resumeResolved) return;
    const target = viewport.querySelector<HTMLElement>(`[data-paper-index="${page}"]`);
    if (target) {
      viewport.scrollTop += target.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 16;
      viewport.scrollLeft = 0;
    }
    const anchor = pendingAnchor.current;
    if (anchor) {
      const attribute = `data-${anchor.kind}-id`;
      Array.from(target?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id)?.scrollIntoView({block: 'start'});
      pendingAnchor.current = null;
    }
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToPage());
    return () => cancelAnimationFrame(frame);
  }, [paperJump, direction, mobile, fontsReady, resumeResolved]);
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
    const first = sourcePageStart(value.document.content, target);
    const frame = requestAnimationFrame(() => {
      if (!paperRef.current) return;
      setSourceJump(null);
      if (target === 0) {paperRef.current.scrollIntoView({block: 'start'}); return;}
      const rect = first && renderedTextRanges(paperRef.current, first)[0]?.getBoundingClientRect();
      if (rect) window.scrollBy({top: rect.top - 72, behavior: 'instant'});
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceJump, mobile, fontsReady, showProductionDetails, value.document.content]);
  useEffect(() => {
    if (!mobile || !fontsReady || notes) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = () => {
      timer = undefined;
      if (!allowAction()) return;
      const sentence = Array.from(viewportRef.current?.querySelectorAll<HTMLElement>('[data-sentence-id]') ?? []).find(element => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 80 && rect.top < window.innerHeight;
      });
      const id = sentence?.dataset.sentenceId;
      if (!id) return;
      const index = sourcePageForSentence(viewportRef.current!, value.document.content, id, 80, window.innerHeight);
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
    window.addEventListener('scroll', scroll, {passive: true});
    globalThis.document.addEventListener('visibilitychange', hide);
    return () => {clearTimeout(timer); window.removeEventListener('scroll', scroll); globalThis.document.removeEventListener('visibilitychange', hide);};
  }, [mobile, fontsReady, notes, allowAction, value.document, storageKey, recordProgress, flushProgress]);
  function onAnchor(anchor: Anchor, record = true, preferredPage?: number) {
    const matches = document.layoutManifest.pages.filter(layout => layout.slots.some(slot => anchor.kind === 'component' ? slot.componentId === anchor.id : slot.fragments.some(fragment => fragment.sentenceId === anchor.id)) || anchor.kind === 'sentence' && layout.fixedSlots?.some(slot => `canonical-${slot.element}` === anchor.id));
    const layout = matches.find(layout => layout.pageId === document.pages[preferredPage ?? -1]?.id) ?? matches[0];
    const index = document.pages.findIndex(page => page.id === layout?.pageId);
    if (index < 0) return;
    if (!onPage(index, record)) return;
    setSourceJump(null);
    if (anchor.kind === 'sentence' && productionSentenceIds.has(anchor.id)) setShowProductionDetails(true);
    if (record && anchor.kind === 'sentence') progress.record(document.pages[index].id, anchor.id);
    pendingAnchor.current = anchor;
    try {sessionStorage.setItem(`${storageKey}:anchor`, JSON.stringify(anchor));} catch { /* Optional restoration. */ }
    if (mobile || index === page) {
      const attribute = `data-${anchor.kind}-id`;
      Array.from(viewportRef.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id)?.scrollIntoView({block: 'start'});
    }
  }
  const restorePosition = useEffectEvent(() => {
    // Restore once, without rewriting progress or letting late sync undo navigation.
    if (resumeResolved || suspended) return;
    const local = restoredPage >= 0 || !!restoredAnchor;
    const target = local ? Math.max(0, restoredPage) : Math.max(0, document.pages.findIndex(page => page.id === cloudProgress?.pageId));
    if (!onPage(target, false)) return;
    const anchor = local ? restoredAnchor : cloudProgress?.sentenceId ? {kind: 'sentence' as const, id: cloudProgress.sentenceId} : cloudProgress?.componentId ? {kind: 'component' as const, id: cloudProgress.componentId} : null;
    if (anchor) onAnchor(anchor, false, target);
  });
  useEffect(() => {
    if (resumeResolved || !fontsReady || suspended) return;
    if (restoredPage < 0 && !restoredAnchor && !privateReader.state && privateReader.status === 'syncing') return;
    // Anchor scrolling needs the font-ready page's completed layout.
    const frame = requestAnimationFrame(() => restorePosition());
    return () => cancelAnimationFrame(frame);
  }, [resumeResolved, fontsReady, suspended, restoredPage, restoredAnchor, privateReader.state, privateReader.status]);
  return <section ref={documentRef} className="reader-document" data-notes-panel={notes && wideNotes || undefined} aria-label={m.title} role="region" onKeyDown={event => {
    if (event.key === 'Escape' && panel) {event.preventDefault(); closePanel(); return;}
    if (event.key === 'Escape' && !notes) {clearSelection(); return;}
    if (!mobile && (event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key) && !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))) {
      event.preventDefault(); changeZoom(zoom + (event.key === '-' ? -.25 : .25)); return;
    }
    const delta = keyboardPageDelta(event, !!window.getSelection()?.toString());
    if (!mobile && direction === 'horizontal' && delta) {event.preventDefault(); onPage(page + delta);}
  }}>
    <div ref={chromeRef} className="reader-chrome">
      <ReaderTabs accountId={selector.accountId} locale={backHref.split('/')[1] as Locale} current={selector} title={value.document.canonicalMetadata.title} messages={m} syncStatus={syncStatus} onSyncDetails={target => openPanel('sync', target)} beforeNavigate={async () => {
        if (!allowAction() || privateReader.busy || notes && !closeNotes()) return false;
        recordVisiblePaper();
        await flushProgress();
        return allowAction();
      }}/>
      <header className="reader-topbar">
        <IconButton variant="ghost" aria-label={m.thumbnails} title={m.thumbnails} aria-expanded={panel === 'pages'} onPress={event => openPanel('pages', event.target)} icon={<PanelLeft size={20} aria-hidden="true"/>}/>
        <IconButton variant="ghost" aria-label={m.search} title={m.search} aria-expanded={panel === 'search'} onPress={event => openPanel('search', event.target)} icon={<Search size={20} aria-hidden="true"/>}/>
        <IconButton buttonRef={notesButton} variant="ghost" aria-label={m.myNotes} title={m.myNotes} isDisabled={!privateReader.state} onPress={() => {setPanel(null); openNotesList(null);}} icon={<StickyNote size={20} aria-hidden="true"/>}/>
        <IconButton variant="ghost" aria-label={m.offlineContent} title={m.offlineContent} aria-expanded={panel === 'offline'} onPress={event => openPanel('offline', event.target)} icon={<Download size={20} aria-hidden="true"/>}/>
        {mobile && productionSentenceIds.size > 0 ? <IconButton variant="ghost" aria-label={m.productionDetails} title={m.productionDetails} aria-expanded={showProductionDetails} onPress={() => {if (notes && !closeNotes()) return; clearSelection(); setShowProductionDetails(value => !value);}} icon={<Info size={20} aria-hidden="true"/>}/> : null}
        {!mobile ? <ReaderToolbar messages={m} zoom={zoom} setZoom={changeZoom}/> : null}
        {!mobile ? <div className="reader-direction-controls" role="group" aria-label={m.readingDirection}>
          <IconButton variant="ghost" aria-label={m.readingDirection} title={`${m.readingDirection}: ${m[direction]}`} aria-expanded={panel === 'direction'} onPress={event => openPanel('direction', event.target)} icon={direction === 'vertical' ? <ChevronsUpDown size={20} aria-hidden="true"/> : <ChevronsLeftRight size={20} aria-hidden="true"/>}/>
        </div> : null}
      </header>
      <aside className="reader-navigation-panel" data-panel={panel} hidden={!panel} aria-label={panel === 'pages' ? m.thumbnails : panel === 'direction' ? m.readingDirection : panel === 'sync' ? m.syncStatus : panel === 'search' ? m.search : m.offlineContent}>
        <header><h2>{panel === 'pages' ? m.thumbnails : panel === 'direction' ? m.readingDirection : panel === 'sync' ? m.syncStatus : panel === 'search' ? m.search : m.offlineContent}</h2><IconButton variant="ghost" aria-label={m.close} onPress={closePanel} icon={<X size={20} aria-hidden="true"/>}/></header>
        {panel === 'pages' ? <><PageNavigator document={document} metadata={value.document.canonicalMetadata} traceCode={value.access.traceCode} page={page} onPage={target => {if (onPage(target)) closePanel();}} messages={m}/><SectionNavigator document={document} onSection={id => {onAnchor({kind: 'component', id}); closePanel();}} messages={m}/></> : null}
        {panel === 'direction' ? <div className="reader-direction-options">{(['vertical', 'horizontal'] as const).map(mode => <Button key={mode} aria-pressed={direction === mode} onPress={() => {setDirection(mode); closePanel();}}>{m[mode]}</Button>)}</div> : null}
        {panel === 'sync' ? <SyncStatus status={syncStatus} messages={m}/> : null}
        <div hidden={panel !== 'search'}><ReaderSearch document={value.document} onJump={id => onAnchor({kind: 'sentence', id})} messages={m} expanded/></div>
        <div hidden={panel !== 'offline'}>{offlineControl}</div>
      </aside>
    </div>
    {value.document.metadataSyncPending ? <p role="status">{m.metadataPending}</p> : null}
    {!privateReader.busy && (privateReader.status === 'paused' || privateReader.status === 'action' || privateReader.pendingMutation) ? <ReaderRecovery api={api} value={value} selector={selector} messages={m} onUpdated={onUpdated} onFailure={onFailure} suspended={suspended} pendingMutation={privateReader.pendingMutation} onPendingChange={mutation => {
      const previous = privateReader.pendingMutation;
      privateReader.replacePending(mutation);
      if (!mutation && previous && ['createNote', 'editNote', 'deleteNote'].includes(previous.kind)) {setNotes(null); setNoteEditorState(undefined); if (previous.kind === 'createNote') clearSelection();}
    }}/> : null}
    {!privateReader.busy && privateReader.canRetry && privateReader.status !== 'paused' ? <><p>{m.confirmRetryHelp}</p><button type="button" disabled={privateReader.busy} onClick={() => {
      const snapshot = selection, kind = privateReader.pendingMutation?.kind;
      void privateReader.retry().then(result => {
      if (result?.status === 'note_conflict' && noteEditorState) setNoteEditorState({...noteEditorState, conflict: {status: 'note_conflict', note: result.note}});
      else if (result?.status === 'applied') {
        if (kind === 'createNote' || kind === 'editNote' || kind === 'deleteNote') {setNotes(null); setNoteEditorState(undefined);}
        if (kind === 'createNote' || kind === 'setHighlight' || kind === 'clearHighlight') clearIf(snapshot);
      }
    }).catch(() => setNotice(m.actionFailed));
    }}>{m.confirmRetry}</button></> : null}
    <div className="reader-stage">
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
      {!fontsReady ? <p role="status">{m.loading}</p> : null}
      <div ref={paperRef} className="reader-paper-with-notes" data-has-notes={hasNotes || undefined} aria-hidden={!fontsReady || undefined} style={{visibility: fontsReady ? 'visible' : 'hidden', width: mobile ? undefined : Math.max(...document.pages.map(entry => entry.width * 4 / 3 * pageScale(zoom, {width: entry.width * 4 / 3, height: entry.height * 4 / 3}, viewport))) + (hasNotes ? 44 : 0)}}>
      {mobile ? <div className="reader-watermarked"><BulletinDocumentRenderer document={mobileDocument} mode="mobile" canonicalMetadata={value.document.canonicalMetadata} sentenceState={sentenceState}/><ReaderWatermark traceCode={value.access.traceCode}/></div> :
        <PaperViewport document={document} metadata={value.document.canonicalMetadata} sentenceState={sentenceState} traceCode={value.access.traceCode} page={page} direction={direction} zoom={zoom} viewport={viewport}/>}
      <NoteIndicators root={paperRef} notes={privateReader.state?.notes ?? []} layoutKey={`${active.id}:${mobile}:${scale}:${fontsReady}:${showProductionDetails}:${direction}`} label={m.myNotes} onOpen={openNotesList}/>
      <RangeHighlights root={paperRef} highlights={savedHighlights} layoutKey={`${active.id}:${mobile}:${scale}:${fontsReady}:${showProductionDetails}:${direction}`} onSelect={selectExisting}/>
      </div>
    </div>
    {!mobile && direction === 'horizontal' ? <>{page > 0 ? <div className="reader-edge reader-edge-previous"><IconButton variant="ghost" aria-label={m.previous} onPress={() => onPage(page - 1)} icon={<ChevronLeft aria-hidden="true"/>}/></div> : null}{page < document.pages.length - 1 ? <div className="reader-edge reader-edge-next"><IconButton variant="ghost" aria-label={m.next} onPress={() => onPage(page + 1)} icon={<ChevronRight aria-hidden="true"/>}/></div> : null}</> : null}
    </div>
    {notice ? <p role="status">{notice}</p> : null}
    <SelectionToolbar messages={m} root={paperRef} ranges={selectionRanges} count={selectionRanges.reduce((count, range) => count + range.end - range.start, 0)} color={highlightSelection.color} clearable={highlightSelection.clearable} busy={privateReader.busy || !privateReader.state || privateReader.status === 'paused'} noteOpen={!!notes} noteButtonRef={noteButton}
      onColor={color => void action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'setHighlight', payload: {sentenceIds: selected, color, ...(selection.ranges ? {ranges: selection.ranges} : {})}})}
      onClear={() => void action({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: value.document.revision, kind: 'clearHighlight', payload: {sentenceIds: selected, ...(selection.ranges ? {ranges: selection.ranges} : {})}})}
      onCopy={() => {const snapshot = selection; void (selection.ranges ? copyTextRanges(value.document, selection.ranges, allowAction) : copySentences(value.document, selected, allowAction)).then(() => {setNotice(m.copySuccess); clearIf(snapshot);}).catch(() => setNotice(m.copyFailed));}}
      onNote={() => {newNoteId.current = null; setNoteEditorState(undefined); setNotes('new');}}/>
    {notes ? <ReaderPrivateState wide={wideNotes} messages={m} onClose={closeNotes} suspended={suspended}>
      {deletion ? <section className="reader-note-editor"><p role="alert">{m.noteConflict}</p><h3>{m.recoveryLocal}</h3><blockquote>{deletion.local.text}</blockquote><h3>{m.recoveryCloud}</h3><blockquote>{deletion.cloud && !deletion.cloud.deleted ? deletion.cloud.text : m.noteDeleted}</blockquote><div className="reader-note-actions">
        <button type="button" disabled={privateReader.busy} onClick={() => setDeletion(null)}>{m.noteCloud}</button>
        {deletion.cloud && !deletion.cloud.deleted ? <><button type="button" disabled={privateReader.busy} onClick={() => {if (window.confirm(m.noteDeleteConfirm)) void deleteNote(deletion.cloud!);}}>{m.noteDelete}</button><button type="button" disabled={privateReader.busy} onClick={() => {setNotes({...deletion.cloud!, text: `${deletion.cloud!.text}\n\n${deletion.local.text}`}); setDeletion(null);}}>{m.noteManual}</button></> : null}
      </div></section> : notes === 'list' ? <NotesPanel messages={m} notes={(privateReader.state?.notes ?? []).filter(note => !noteFilter || noteFilter.includes(note.id))} onJump={id => onAnchor({kind: 'sentence', id})} onEdit={note => {newNoteId.current = null; setNoteEditorState(undefined); setNotes(note);}} onDelete={note => {
        if (window.confirm(m.noteDeleteConfirm)) void deleteNote(note);
      }}/> : <NoteEditor key={typeof notes === 'object' ? notes.id : 'new'} messages={m} note={typeof notes === 'object' ? notes : undefined} quote={noteQuote} editorState={noteEditorState} onEditorStateChange={setNoteEditorState} onSave={saveNote} onComplete={() => {if (notes === 'new') clearSelection(); setNotes(null); setNoteEditorState(undefined); requestAnimationFrame(() => notesButton.current?.focus());}} onCancel={closeNotes}/>}
    </ReaderPrivateState> : null}
  </section>;
}
