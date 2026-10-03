import {useEffect, useRef} from 'react';
import {Button, BulletinDocumentRenderer, ReaderWatermark, type BulletinRenderableDocument, type BulletinCanonicalMetadata} from '@hallelujahhomechurch/ui';
import type {ReaderMessages} from './ReaderToolbar';

export function PageNavigator({document, metadata, page, onPage, messages: m, traceCode}: {document: BulletinRenderableDocument; metadata: BulletinCanonicalMetadata; page: number; onPage: (page: number) => void; messages: ReaderMessages; traceCode: string}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {root.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block: 'nearest'});}, [page]);
  return <nav ref={root} className="reader-thumbnails" aria-label={m.thumbnails}>{document.pages.map((entry, index) => {
    const scale = 112 / (entry.width * 4 / 3);
    return <Button key={entry.id} type="button" className="reader-thumbnail" aria-label={`${m.page} ${index + 1}`} aria-current={page === index ? 'page' : undefined} onPress={() => onPage(index)}>
      <span aria-hidden="true" inert className="reader-thumbnail-image" style={{width: 112, height: entry.height * 4 / 3 * scale}}><span style={{display: 'block', position: 'relative', width: entry.width * 4 / 3, transform: `scale(${scale})`, transformOrigin: 'top left'}}><BulletinDocumentRenderer document={document} mode="paper" activePage={entry.id} canonicalMetadata={metadata}/><ReaderWatermark traceCode={traceCode}/></span></span>
      <span>{index + 1}</span>
    </Button>;
  })}</nav>;
}
