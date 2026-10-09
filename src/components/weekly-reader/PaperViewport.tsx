import {useMemo, type ComponentProps, type CSSProperties} from 'react';
import {BulletinDocumentRenderer, ReaderWatermark} from '@hallelujahhomechurch/ui';
import {centeredBodyOffset, pageScale, type ReaderZoom} from '@/features/weekly-reader/navigation';

export type ReadingDirection = 'vertical' | 'horizontal';
type RendererProps = ComponentProps<typeof BulletinDocumentRenderer>;
type Props = {document: RendererProps['document']; metadata: RendererProps['canonicalMetadata']; sentenceState?: RendererProps['sentenceState']; traceCode: string; theme?: 'light' | 'dark'; page: number; direction: ReadingDirection; zoom: ReaderZoom; viewport: {width: number; height: number}};

/** Presentation-only geometry; text widths and fragment anchors stay unchanged. */
function backCoverPresentation(document: RendererProps['document']) {
  return {...document.layoutManifest, pages: document.layoutManifest.pages.map(layout => {
    const page = document.pages.find(page => page.id === layout.pageId)!;
    const fixed = layout.fixedSlots ?? [];
    const summary = fixed.find(slot => slot.element === 'summaryFrame');
    if (!summary) return layout;
    const groups = (['announcements', 'prayers'] as const).map(type => {
      const ids = new Set(document.components.filter(component => component.type === (type === 'prayers' ? 'victoriesAndPrayers' : type)).map(component => component.id));
      const slots = layout.slots.filter(slot => ids.has(slot.componentId));
      const frame = fixed.find(slot => slot.element === `${type}Frame`);
      const label = fixed.find(slot => slot.element === `${type}Label`);
      if (!frame || !slots.length) return null;
      const boxes = [...slots, ...(label ? [label] : [])].map(slot => slot.box);
      const top = Math.min(...boxes.map(box => box.y)) - 6 / page.height;
      const bottom = Math.max(...boxes.map(box => box.y + box.height)) + 6 / page.height;
      return {type, slots, frame, label, boxes, top, bottom, shift: 0};
    }).filter(group => group !== null);
    if (!groups.length) return layout;
    const boxes = groups.flatMap(group => group.boxes);
    const left = Math.max(0, Math.min(...boxes.map(box => box.x)) - 6 / page.width);
    const right = Math.min(1, Math.max(...boxes.map(box => box.x + box.width)) + 6 / page.width);
    let bottom = summary.box.y + summary.box.height;
    for (const group of groups) {
      group.shift = Math.max(0, bottom + 12 / page.height - group.top);
      bottom = group.bottom + group.shift;
    }
    // Dense pages keep their source geometry rather than overflowing or silently shrinking text.
    if (bottom > 1 - 6 / page.height) return layout;
    return {...layout,
      slots: layout.slots.map(slot => {
        const group = groups.find(group => group.slots.includes(slot));
        return group ? {...slot, box: {...slot.box, y: slot.box.y + group.shift}} : slot;
      }),
      fixedSlots: fixed.map(slot => {
        const group = groups.find(group => group.frame === slot || group.label === slot);
        if (!group) return slot;
        return {...slot, box: group.frame === slot
          ? {x: left, y: group.top + group.shift, width: right - left, height: group.bottom - group.top}
          : {...slot.box, y: slot.box.y + group.shift}};
      })};
  })};
}

/** Display-only normalization; canonical data remains unchanged. */
export function paperPresentation(document: RendererProps['document']): RendererProps['document'] {
  return {...document, layoutManifest: backCoverPresentation(document), components: document.components.map(component => component.type !== 'cover' ? component : {...component, cover: {...component.cover, weeklyVerses: component.cover.weeklyVerses.map(block => ({...block, sentences: block.sentences.map(sentence => ({...sentence, spans: sentence.spans.map(span => span.fontRole === 'body' || span.fontRole === 'reference' ? {...span, fontRole: 'scripture' as const} : span)}))}))}})};
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
