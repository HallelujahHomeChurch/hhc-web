import {useEffect, useRef, useState} from 'react';
import {Button, BulletinDocumentRenderer, type BulletinRenderableDocument, type BulletinCanonicalMetadata} from '@hallelujahhomechurch/ui';
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
    {!mobile && <Button type="button" aria-label={m.previous} isDisabled={page === 0} onPress={() => onPage(page - 1)}><ChevronLeft aria-hidden="true" size={18}/></Button>}
    <Button type="button" className="reader-page-position" aria-label={`${m.sourcePage} ${page + 1} / ${document.pages.length}`} onPress={onOpen}><span className="reader-source-label">{m.sourcePage}</span> {page + 1}<span className="reader-page-total"> / {document.pages.length}</span></Button>
    {!mobile && <Button type="button" aria-label={m.next} isDisabled={page === document.pages.length - 1} onPress={() => onPage(page + 1)}><ChevronRight aria-hidden="true" size={18}/></Button>}
  </nav>;
  return <>
    <nav className="reader-page-controls" aria-label={m.page}>
      <Button type="button" isDisabled={page === 0} onPress={() => onPage(page - 1)}>{m.previous}</Button>
      <label>{m.page} <input aria-label={m.page} ref={input} type="number" min={1} max={document.pages.length} defaultValue={page + 1} onBlur={event => commitInput(event.currentTarget)} onKeyDown={event => {if (event.key === 'Enter') commitInput(event.currentTarget, true);}}/> / {document.pages.length}</label>
      <Button type="button" isDisabled={page === document.pages.length - 1} onPress={() => onPage(page + 1)}>{m.next}</Button>
      <Button type="button" aria-expanded={thumbnails} onPress={() => setThumbnails(value => !value)}>{m.thumbnails}</Button>
    </nav>
    {page > 0 && page < document.sourcePageCount - 1 ? <p className="reader-page-caption">{m.printedPage.replace('{page}', String(page))}</p> : null}
    {thumbnails ? <nav className="reader-thumbnails" aria-label={m.thumbnails}>{document.pages.map((entry, index) => {
      const scale = 96 / (entry.width * 4 / 3);
      return <div key={entry.id} className="reader-thumbnail">
        <div aria-hidden="true" inert className="reader-thumbnail-image" style={{width: 96, height: entry.height * 4 / 3 * scale}}><div style={{transform: `scale(${scale})`, transformOrigin: 'top left'}}><BulletinDocumentRenderer document={document} mode="paper" activePage={entry.id} canonicalMetadata={metadata}/></div></div>
        <Button type="button" aria-current={page === index ? 'page' : undefined} onPress={() => onPage(index)}>{m.page} {index + 1}</Button>
      </div>;
    })}</nav> : null}
  </>;
}
