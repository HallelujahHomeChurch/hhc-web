'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {BulletinDocumentRenderer, ReaderWatermark} from '@hallelujahhomechurch/ui';
import type {OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import type {BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';
import {useAccountAuth, useAccountIdentity, useAccountSignIn, useBulletinAccess, useBulletinAuthorization} from '@/components/layout/AccountControl';
import {createReaderApi, verifyReaderAccess, type ReaderSelector} from '@/features/weekly-reader/api';
import {keyboardPageDelta, pageScale, swipeDirection, type ReaderZoom} from '@/features/weekly-reader/navigation';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';
import {getOfflineIdentity, supportsOfflineReader} from '@/features/weekly-reader/offline-store';
import {watchOfflineAccount} from '@/features/weekly-reader/offline-session';
import {useReaderSession} from '@/features/weekly-reader/useReaderSession';
import type {Locale} from '@/i18n/locales';
import {ReaderToolbar, type ReaderMessages} from './ReaderToolbar';
import {PageNavigator} from './PageNavigator';
import {SectionNavigator} from './SectionNavigator';
import {ReaderSearch} from './ReaderSearch';
import {OfflineControl} from './OfflineControl';
import {ResumeReadingPrompt} from './ResumeReadingPrompt';
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
    <a className="reader-back" href={`/${props.locale}/literature-ministry`}>{m.back}</a>
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
  if (session.value) return <div onClickCapture={guard} onKeyDownCapture={guard} onPointerDownCapture={guard} onCopyCapture={guard}>
    {session.offline ? <p role="status">{m.offlineNotice}</p> : null}
    {session.loginRequired ? <button type="button" onClick={() => void signIn?.()}>{m.signIn}</button> : null}
    <OfflineControl api={api} value={session.value} selector={selector} locale={props.locale} messages={m} onSaved={session.acceptSaved}/>
    <ReaderDocument key={`${session.value.document.documentId}:${session.value.document.revision}`} value={session.value} selector={selector} messages={m}/>
  </div>;
  return <section className="reader-status" role={session.error ? 'alert' : 'status'}><h1>{m.title}</h1><p>{session.error ? m[session.error] : m.loading}</p>{session.error ? <button type="button" onClick={session.retry}>{m.retry}</button> : null}</section>;
}

function ReaderDocument({value, selector, messages: m}: {value: OnlineBulletinAccess; selector: ReaderSelector; messages: ReaderMessages}) {
  const document = useMemo(() => verifyReaderAccess(value, selector), [value, selector]);
  const storageKey = `weekly-reader-position:${selector.accountId}:${value.document.documentId}:${value.document.revision}`;
  const [restoredAnchor] = useState<Anchor | null>(() => {
    try {const anchor = JSON.parse(sessionStorage.getItem(`${storageKey}:anchor`) ?? 'null'); return anchor && ['component', 'sentence'].includes(anchor.kind) && typeof anchor.id === 'string' ? anchor : null;} catch {return null;}
  });
  const [restoredPage] = useState(() => {
    try {const id = sessionStorage.getItem(storageKey); return Math.max(0, document.pages.findIndex(page => page.id === id));} catch {return 0;}
  });
  const [resumePending, setResumePending] = useState(!!restoredAnchor || restoredPage > 0);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState<ReaderZoom>('page');
  const [mobile, setMobile] = useState(false);
  const [fontsReady, setFontsReady] = useState(() => !globalThis.document?.fonts);
  const [viewport, setViewport] = useState({width: 900, height: 700});
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<Anchor | null>(null);
  const gesture = useRef<{x: number; y: number; multiplePointers: boolean} | null>(null);
  const pointers = useRef(new Set<number>());
  const active = document.pages[page];
  const size = {width: active.width * 4 / 3, height: active.height * 4 / 3};
  const scale = pageScale(zoom, size, viewport);
  const onPage = (next: number) => {
    if (!Number.isFinite(next)) return;
    setResumePending(false);
    pendingAnchor.current = null;
    try {sessionStorage.removeItem(`${storageKey}:anchor`);} catch { /* Optional restoration. */ }
    setPage(Math.max(0, Math.min(document.pages.length - 1, Math.floor(next))));
  };
  useEffect(() => {
    let active = true;
    void globalThis.document.fonts?.ready.then(() => {if (active) setFontsReady(true);});
    return () => {active = false;};
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const changed = () => setMobile(query.matches);
    changed(); query.addEventListener('change', changed);
    const root = viewportRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect?.width && rect.height) setViewport({width: Math.max(1, rect.width - 32), height: Math.max(1, rect.height - 32)});
    });
    if (root) observer?.observe(root);
    return () => {query.removeEventListener('change', changed); observer?.disconnect();};
  }, []);
  useEffect(() => {
    if (resumePending) return;
    try {sessionStorage.setItem(storageKey, active.id);} catch { /* Reading remains available without storage. */ }
    if (!mobile && viewportRef.current) {viewportRef.current.scrollTop = 0; viewportRef.current.scrollLeft = 0;}
    const anchor = pendingAnchor.current;
    if (anchor && fontsReady) {
      const attribute = `data-${anchor.kind}-id`;
      Array.from(viewportRef.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id)?.scrollIntoView({block: 'start'});
      pendingAnchor.current = null;
    }
  }, [active.id, mobile, storageKey, fontsReady, resumePending]);
  function onAnchor(anchor: Anchor) {
    const layout = document.layoutManifest.pages.find(layout => layout.slots.some(slot => anchor.kind === 'component' ? slot.componentId === anchor.id : slot.fragments.some(fragment => fragment.sentenceId === anchor.id)) || anchor.kind === 'sentence' && layout.fixedSlots?.some(slot => `canonical-${slot.element}` === anchor.id));
    const index = document.pages.findIndex(page => page.id === layout?.pageId);
    if (index < 0) return;
    onPage(index);
    pendingAnchor.current = anchor;
    try {sessionStorage.setItem(`${storageKey}:anchor`, JSON.stringify(anchor));} catch { /* Optional restoration. */ }
    if (mobile || index === page) {
      const attribute = `data-${anchor.kind}-id`;
      Array.from(viewportRef.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? []).find(element => element.getAttribute(attribute) === anchor.id)?.scrollIntoView({block: 'start'});
    }
  }
  return <section className="reader-document" aria-label={m.title} role="region" onKeyDown={event => {
    const delta = keyboardPageDelta(event, !!window.getSelection()?.toString());
    if (!mobile && delta) {event.preventDefault(); onPage(page + delta);}
  }}>
    <header className="reader-heading"><h1 lang={value.document.contentLocale}>{value.document.canonicalMetadata.title}</h1>{value.document.canonicalMetadata.subtitle ? <p lang={value.document.contentLocale}>{value.document.canonicalMetadata.subtitle}</p> : null}{value.document.metadataSyncPending ? <p role="status">{m.metadataPending}</p> : null}</header>
    {resumePending ? <ResumeReadingPrompt messages={m} onContinue={() => {onPage(restoredPage); if (restoredAnchor) onAnchor(restoredAnchor);}} onStartOver={() => onPage(0)}/> : null}
    <div className="reader-toolbar">{!mobile ? <ReaderToolbar messages={m} zoom={zoom} setZoom={setZoom}/> : null}<SectionNavigator document={document} onSection={id => onAnchor({kind: 'component', id})} messages={m}/><ReaderSearch document={value.document} onJump={id => onAnchor({kind: 'sentence', id})} messages={m}/></div>
    {!mobile ? <PageNavigator document={document} metadata={value.document.canonicalMetadata} page={page} onPage={onPage} messages={m}/> : null}
    <div ref={viewportRef} className="reader-viewport" data-mobile={mobile || undefined} tabIndex={0} onPointerDown={event => {
      if (event.pointerType !== 'touch') return;
      pointers.current.add(event.pointerId);
      if (!gesture.current) gesture.current = {x: event.clientX, y: event.clientY, multiplePointers: false};
      if (pointers.current.size > 1) gesture.current.multiplePointers = true;
    }} onPointerCancel={() => {pointers.current.clear(); gesture.current = null;}} onPointerUp={event => {
      pointers.current.delete(event.pointerId);
      const start = gesture.current;
      if (!start || pointers.current.size) return;
      gesture.current = null;
      const delta = swipeDirection({...start, dx: event.clientX - start.x, dy: event.clientY - start.y, zoomed: scale > pageScale('width', size, viewport), hasSelection: !!window.getSelection()?.toString()});
      if (!mobile && delta) onPage(page + delta);
    }}>
      {!fontsReady ? <p role="status">{m.loading}</p> : null}
      <div aria-hidden={!fontsReady || undefined} style={{visibility: fontsReady ? 'visible' : 'hidden'}}>
      {mobile ? <div className="reader-watermarked"><BulletinDocumentRenderer document={document} mode="mobile" canonicalMetadata={value.document.canonicalMetadata}/><ReaderWatermark traceCode={value.access.traceCode}/></div> :
        <div className="reader-scaled-page" style={{width: size.width * scale, height: size.height * scale}}><div className="reader-watermarked" style={{transform: `scale(${scale})`, transformOrigin: 'top left', width: size.width, height: size.height}}><BulletinDocumentRenderer document={document} mode="paper" activePage={active.id} canonicalMetadata={value.document.canonicalMetadata}/><ReaderWatermark traceCode={value.access.traceCode}/></div></div>}
      </div>
    </div>
  </section>;
}
