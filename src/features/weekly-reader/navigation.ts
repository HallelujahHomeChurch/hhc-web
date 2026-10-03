import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';

/** Translate the existing body column; never resize text or move it to another page. */
export function centeredBodyOffset(document: MemberOnlineDocument['content'], pageId: string) {
  const slots = document.layoutManifest.pages.find(page => page.pageId === pageId)?.slots ?? [];
  const body = new Set(document.components.filter(component => component.type === 'bodySection').map(component => component.id));
  if (!slots.length || slots.some(slot => !body.has(slot.componentId))) return 0;
  const left = Math.min(...slots.map(slot => slot.box.x));
  const right = Math.max(...slots.map(slot => slot.box.x + slot.box.width));
  return (1 - right - left) / 2;
}

export type ReaderZoom = 'page' | 'width' | number;
export function pageScale(zoom: ReaderZoom, page: {width: number; height: number}, viewport: {width: number; height: number}) {
  if (typeof zoom === 'number') return Math.max(.75, Math.min(2.5, zoom));
  const width = viewport.width / page.width;
  return Math.max(.1, zoom === 'width' ? width : Math.min(width, viewport.height / page.height));
}

export function swipeDirection({dx, dy, multiplePointers, zoomed, hasSelection}: {dx: number; dy: number; multiplePointers: boolean; zoomed: boolean; hasSelection: boolean}) {
  return multiplePointers || zoomed || hasSelection || Math.abs(dx) < 60 || Math.abs(dy) > 30 ? 0 : dx < 0 ? 1 : -1;
}

export function keyboardPageDelta(event: {key: string; target: EventTarget | null; ctrlKey: boolean; metaKey: boolean; altKey: boolean}, hasSelection: boolean) {
  if (hasSelection || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return 0;
  return ['ArrowRight', 'PageDown'].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 0;
}
