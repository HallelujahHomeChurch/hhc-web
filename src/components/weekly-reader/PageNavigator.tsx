import {useEffect, useRef, useState} from 'react';
import {BulletinDocumentRenderer, type BulletinRenderableDocument, type BulletinCanonicalMetadata} from '@hallelujahhomechurch/ui';
import type {ReaderMessages} from './ReaderToolbar';
import {ChevronLeft, ChevronRight} from 'lucide-react';

export function PageNavigator({document, metadata, page, onPage, messages: m, compact, mobile, onOpen}: {document: BulletinRenderableDocument; metadata: BulletinCanonicalMetadata; page: number; onPage: (page: number) => void; messages: ReaderMessages; compact?: boolean; mobile?: boolean; onOpen?: () => void}) {
  const [thumbnails, setThumbnails] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {if (input.current) input.current.value = String(page + 1);}, [page]);
  function commitInput(element: HTMLInputElement, explicit = false) {
    const value = element.valueAsNumber;
    const next = Number.isFinite(value) ? Math.max(1, Math.min(document.pages.length, Math.floor(value))) : page + 1;
    element.value = String(next);
    if (next - 1 !== page || explicit) onPage(next - 1);
  }
  if (compact) return <nav className="reader-quick-pages" aria-label={m.sourcePage}>
    {!mobile && <button type="button" aria-label={m.previous} title={m.previous} disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" size={18}/></button>}
    <button type="button" className="reader-page-position" aria-label={`${m.sourcePage} ${page + 1} / ${document.pages.length}`} onClick={onOpen}><span className="reader-source-label">{m.sourcePage}</span> {page + 1}<span className="reader-page-total"> / {document.pages.length}</span></button>
    {!mobile && <button type="button" aria-label={m.next} title={m.next} disabled={page === document.pages.length - 1} onClick={() => onPage(page + 1)}><ChevronRight aria-hidden="true" size={18}/></button>}
  </nav>;
  return <>
    <nav className="reader-page-controls" aria-label={m.page}>
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>{m.previous}</button>
      <label>{m.page} <input aria-label={m.page} ref={input} type="number" min={1} max={document.pages.length} defaultValue={page + 1} onBlur={event => commitInput(event.currentTarget)} onKeyDown={event => {if (event.key === 'Enter') commitInput(event.currentTarget, true);}}/> / {document.pages.length}</label>
      <button type="button" disabled={page === document.pages.length - 1} onClick={() => onPage(page + 1)}>{m.next}</button>
      <button type="button" aria-expanded={thumbnails} onClick={() => setThumbnails(value => !value)}>{m.thumbnails}</button>
    </nav>
    {page > 0 && page < document.sourcePageCount - 1 ? <p className="reader-page-caption">{m.printedPage.replace('{page}', String(page))}</p> : null}
    {thumbnails ? <nav className="reader-thumbnails" aria-label={m.thumbnails}>{document.pages.map((entry, index) => {
      const scale = 96 / (entry.width * 4 / 3);
      return <div key={entry.id} className="reader-thumbnail">
        <div aria-hidden="true" inert className="reader-thumbnail-image" style={{width: 96, height: entry.height * 4 / 3 * scale}}><div style={{transform: `scale(${scale})`, transformOrigin: 'top left'}}><BulletinDocumentRenderer document={document} mode="paper" activePage={entry.id} canonicalMetadata={metadata}/></div></div>
        <button type="button" aria-current={page === index ? 'page' : undefined} onClick={() => onPage(index)}>{m.page} {index + 1}</button>
      </div>;
    })}</nav> : null}
  </>;
}
