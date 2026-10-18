import {bulletinChapters, bulletinBlocks} from '@hallelujahhomechurch/ui';
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

export type ReadingAnchor = {kind: 'sentence' | 'component'; id: string; start?: number; page: number};

/** Keep the source fragment when a sentence spans several paper pages. */
export function resolveReadingAnchor(document: MemberOnlineDocument['content'], anchor: ReadingAnchor, excluded: ReadonlySet<string> = new Set()): {anchor: ReadingAnchor; fallback: boolean} | null {
  const source = document.layoutManifest.pages.find(layout => layout.pageId === document.pages[anchor.page]?.id);
  const contains = (fragment: {sentenceId: string; start: number; end: number}) => fragment.sentenceId === anchor.id && !excluded.has(fragment.sentenceId) && (anchor.start === undefined || fragment.start <= anchor.start && fragment.end > anchor.start);
  if (anchor.kind === 'sentence' && (source?.slots.some(slot => slot.fragments.some(contains)) || source?.fixedSlots?.some(slot => `canonical-${slot.element}` === anchor.id))) return {anchor, fallback: false};
  if (anchor.kind === 'component' && source?.slots.some(slot => slot.componentId === anchor.id)) return {anchor, fallback: false};
  const first = sourcePageStart(document, anchor.page, excluded);
  if (first) return {anchor: {kind: 'sentence', id: first.sentenceId, start: first.start, page: anchor.page}, fallback: true};
  const component = anchor.kind === 'component' ? anchor.id : bulletinBlocks(document).find(entry => entry.block.sentences.some(sentence => sentence.id === anchor.id))?.componentId;
  const chapter = bulletinChapters(document).find(entry => component && entry.componentIds.includes(component));
  const candidates = new Set([component, ...(chapter?.componentIds ?? [])]);
  for (const [page, entry] of document.pages.entries()) {
    const layout = document.layoutManifest.pages.find(layout => layout.pageId === entry.id);
    const fragment = layout?.slots.filter(slot => candidates.has(slot.componentId)).flatMap(slot => slot.fragments).find(fragment => !excluded.has(fragment.sentenceId));
    if (chapter && fragment) return {anchor: {kind: 'sentence', id: fragment.sentenceId, start: fragment.start, page}, fallback: true};
  }
  return null;
}

export function visibleReadingAnchor(root: HTMLElement, document: MemberOnlineDocument['content'], top: number, fallbackPage: number): ReadingAnchor {
  const bottom = root.closest('.reader-viewport')?.getBoundingClientRect().bottom ?? root.getBoundingClientRect().bottom;
  const sentence = Array.from(root.querySelectorAll<HTMLElement>('[data-sentence-id]')).find(node => !node.closest('[hidden],[inert],[aria-hidden="true"]') && node.getBoundingClientRect().bottom > top && node.getBoundingClientRect().top < bottom);
  if (!sentence) {
    const source = document.layoutManifest.pages.find(layout => layout.pageId === document.pages[fallbackPage]?.id);
    return {kind: 'component', id: source?.slots[0]?.componentId ?? '', page: fallbackPage};
  }
  const id = sentence.dataset.sentenceId!, from = Number(sentence.dataset.fragmentStart), to = Number(sentence.dataset.fragmentEnd);
  let start = Number.isSafeInteger(from) ? from : 0;
  // Binary-search the visible scalar, without changing the rendered text.
  if (Number.isSafeInteger(to) && to > start) {
    let end = to - 1;
    while (start < end) {
      const middle = Math.floor((start + end) / 2), range = renderedTextRanges(root, {sentenceId: id, start: middle, end: middle + 1}).find(range => typeof range.getBoundingClientRect === 'function');
      if (!range || range.getBoundingClientRect().bottom > top) end = middle; else start = middle + 1;
    }
  }
  const paperPage = sentence.closest<HTMLElement>('[data-paper-index]');
  const source = document.layoutManifest.pages.find(layout => layout.slots.some(slot => slot.fragments.some(fragment => fragment.sentenceId === id && fragment.start <= start && fragment.end > start)));
  const page = paperPage ? Number(paperPage.dataset.paperIndex) : document.pages.findIndex(page => page.id === source?.pageId);
  return {kind: 'sentence', id, start, page: page >= 0 ? page : fallbackPage};
}
