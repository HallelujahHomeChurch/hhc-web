import type {ComponentProps, CSSProperties} from 'react';
import {BulletinDocumentRenderer, ReaderWatermark} from '@hallelujahhomechurch/ui';
import {centeredBodyOffset, pageScale, type ReaderZoom} from '@/features/weekly-reader/navigation';

export type ReadingDirection = 'vertical' | 'horizontal';
type RendererProps = ComponentProps<typeof BulletinDocumentRenderer>;
type Props = {document: RendererProps['document']; metadata: RendererProps['canonicalMetadata']; sentenceState?: RendererProps['sentenceState']; traceCode: string; page: number; direction: ReadingDirection; zoom: ReaderZoom; viewport: {width: number; height: number}};

/** Paper-only presentation. The outer reader owns selection, access and scrolling. */
export function PaperViewport({document, metadata, sentenceState, traceCode, page, direction, zoom, viewport}: Props) {
  return document.pages.map((entry, index) => {
    if (direction === 'horizontal' && index !== page) return null;
    const size = {width: entry.width * 4 / 3, height: entry.height * 4 / 3};
    const scale = pageScale(zoom, size, viewport);
    return <div key={entry.id} className="reader-scaled-page" data-paper-index={index} style={{width: size.width * scale, height: size.height * scale, '--reader-body-offset': `${centeredBodyOffset(document, entry.id) * size.width}px`} as CSSProperties}>
      <div className="reader-watermarked" style={{transform: `scale(${scale})`, transformOrigin: 'top left', width: size.width, height: size.height}}>
        <BulletinDocumentRenderer document={document} mode="paper" activePage={entry.id} canonicalMetadata={metadata} sentenceState={sentenceState}/>
        <ReaderWatermark traceCode={traceCode}/>
      </div>
    </div>;
  });
}
