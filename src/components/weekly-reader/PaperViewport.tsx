import {useMemo, type ComponentProps, type CSSProperties} from 'react';
import {BulletinDocumentRenderer, ReaderWatermark, bulletinBackPanelPresentation} from '@hallelujahhomechurch/ui';
import {centeredBodyOffset, pageScale, type ReaderZoom} from '@/features/weekly-reader/navigation';

export type ReadingDirection = 'vertical' | 'horizontal';
type RendererProps = ComponentProps<typeof BulletinDocumentRenderer>;
type Props = {document: RendererProps['document']; metadata: RendererProps['canonicalMetadata']; sentenceState?: RendererProps['sentenceState']; traceCode: string; theme?: 'light' | 'dark'; page: number; direction: ReadingDirection; zoom: ReaderZoom; viewport: {width: number; height: number}};

/** Display-only normalization; canonical data remains unchanged. */
export function paperPresentation(document: RendererProps['document']): RendererProps['document'] {
  return {...document, layoutManifest: bulletinBackPanelPresentation(document), components: document.components.map(component => component.type !== 'cover' ? component : {...component, cover: {...component.cover, weeklyVerses: component.cover.weeklyVerses.map(block => ({...block, sentences: block.sentences.map(sentence => ({...sentence, spans: sentence.spans.map(span => span.fontRole === 'body' || span.fontRole === 'reference' ? {...span, fontRole: 'scripture' as const} : span)}))}))}})};
}

/** Paper-only presentation. The outer reader owns selection, access and scrolling. */
export function PaperViewport({document, metadata, sentenceState, traceCode, theme = 'light', page, direction, zoom, viewport}: Props) {
  const presentation = useMemo(() => paperPresentation(document), [document]);
  return document.pages.map((entry, index) => {
    if (direction === 'horizontal' && index !== page) return null;
    const size = {width: entry.width * 4 / 3, height: entry.height * 4 / 3};
    const scale = pageScale(zoom, size, viewport);
    return <div key={entry.id} className="reader-scaled-page" data-paper-index={index} data-reader-renderer={document.layoutManifest.rendererVersion} style={{width: size.width * scale, height: size.height * scale, '--reader-body-offset': `${centeredBodyOffset(document, entry.id) * size.width}px`} as CSSProperties}>
      <div className="reader-watermarked" style={{transform: `scale(${scale})`, transformOrigin: 'top left', width: size.width, height: size.height}}>
        <BulletinDocumentRenderer document={presentation} mode="paper" activePage={entry.id} canonicalMetadata={metadata} sentenceState={sentenceState}/>
        <ReaderWatermark traceCode={traceCode} tone={theme}/>
      </div>
    </div>;
  });
}
