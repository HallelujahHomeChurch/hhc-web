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
