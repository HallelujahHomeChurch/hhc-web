import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {renderedTextRanges} from './text-range';

export function sourcePageForSentence(root: HTMLElement, document: MemberOnlineDocument['content'], sentenceId: string, top: number, bottom: number) {
  let result = -1, firstVisibleTop = Infinity;
  document.layoutManifest.pages.forEach((page, index) => {
    if (result < 0 && page.fixedSlots?.some(slot => `canonical-${slot.element}` === sentenceId)) result = index;
    for (const fragment of page.slots.flatMap(slot => slot.fragments)) {
      if (fragment.sentenceId !== sentenceId) continue;
      for (const range of renderedTextRanges(root, fragment)) {
        if (typeof range.getClientRects !== 'function') {if (result < 0) result = index; continue;}
        const rect = Array.from(range.getClientRects()).find(rect => rect.bottom > top && rect.top < bottom);
        // A source page break may share a mobile line with the previous page.
        if (rect && rect.top <= firstVisibleTop) {result = index; firstVisibleTop = rect.top;}
      }
    }
  });
  return result;
}

/** A page can begin midway through a sentence; keep its scalar offset. */
export function sourcePageStart(document: MemberOnlineDocument['content'], index: number, excluded?: ReadonlySet<string>) {
  const page = document.layoutManifest.pages.find(layout => layout.pageId === document.pages[index]?.id);
  const first = page?.slots.slice().sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x).flatMap(slot => slot.fragments).find(fragment => !excluded?.has(fragment.sentenceId));
  return first ? {sentenceId: first.sentenceId, start: first.start, end: first.start + 1} : undefined;
}

export type ReaderZoom = number;
export function clampPaperZoom(value: number) {return Number.isFinite(value) ? Math.max(1, Math.min(4, value)) : 1;}
export function fittedPageScale(page: {width: number; height: number}, viewport: {width: number; height: number}) {
  return Math.max(.01, Math.min(viewport.width / page.width, viewport.height / page.height));
}
export function pageScale(zoom: ReaderZoom, page: {width: number; height: number}, viewport: {width: number; height: number}) {
  return fittedPageScale(page, viewport) * clampPaperZoom(zoom);
}

export function swipeDirection({dx, dy, multiplePointers, zoomed, hasSelection}: {dx: number; dy: number; multiplePointers: boolean; zoomed: boolean; hasSelection: boolean}) {
  return multiplePointers || zoomed || hasSelection || Math.abs(dx) < 60 || Math.abs(dy) > 30 ? 0 : dx < 0 ? 1 : -1;
}

export function keyboardPageDelta(event: {key: string; target: EventTarget | null; ctrlKey: boolean; metaKey: boolean; altKey: boolean}, hasSelection: boolean) {
  if (hasSelection || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return 0;
  return ['ArrowRight', 'PageDown'].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 0;
}
