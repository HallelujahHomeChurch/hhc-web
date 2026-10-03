import {useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject} from 'react';
import {clampPaperZoom} from './navigation';

type Point = {x: number; y: number};
type Anchor = {page: string; x: number; y: number; point: Point};
type Props = {root: RefObject<HTMLDivElement | null>; enabled: boolean; blocked: boolean; zoom: number; setZoom: (zoom: number) => void; layoutKey?: string};

/** Scope cancellation to paper; native one-finger scrolling/text selection stays available. */
export function usePaperGestures({root, enabled, blocked, zoom, setZoom, layoutKey}: Props) {
  const pending = useRef<Anchor | null>(null);
  const liveZoom = useRef(zoom);
  useLayoutEffect(() => {liveZoom.current = zoom;}, [zoom]);
  function captureAnchor(point?: Point) {
    const element = root.current;
    if (!element || !enabled) return;
    const bounds = element.getBoundingClientRect();
    const focus = point ?? {x: bounds.left + element.clientWidth / 2, y: bounds.top + element.clientHeight / 2};
    const pages = Array.from(element.querySelectorAll<HTMLElement>('[data-paper-index]'));
    const page = pages.find(page => {const rect = page.getBoundingClientRect(); return rect.bottom > focus.y && rect.top <= focus.y;}) ?? pages.find(page => page.getBoundingClientRect().bottom > bounds.top);
    if (page) {
      const rect = page.getBoundingClientRect();
      if (rect.width && rect.height) pending.current = {page: page.dataset.paperIndex!, x: (focus.x - rect.left) / rect.width, y: (focus.y - rect.top) / rect.height, point: focus};
    }
  }
  function change(next: number, point?: Point) {
    if (!enabled || blocked || clampPaperZoom(next) === liveZoom.current) return;
    captureAnchor(point);
    liveZoom.current = clampPaperZoom(next);
    setZoom(liveZoom.current);
  }
  const applyZoom = useEffectEvent(change);
  useLayoutEffect(() => {
    const anchor = pending.current, element = root.current;
    if (!anchor || !element) return;
    pending.current = null;
    const page = element.querySelector<HTMLElement>(`[data-paper-index="${anchor.page}"]`);
    if (!page) return;
    const rect = page.getBoundingClientRect();
    element.scrollBy({left: rect.left + rect.width * anchor.x - anchor.point.x, top: rect.top + rect.height * anchor.y - anchor.point.y, behavior: 'instant'});
  }, [zoom, root, layoutKey]);
  useEffect(() => {
    const element = root.current;
    if (!enabled || blocked || !element) return;
    let pinch: {distance: number; zoom: number} | null = null;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      applyZoom(liveZoom.current * Math.exp(-pixels * .002), {x: event.clientX, y: event.clientY});
    };
    const distance = (touches: TouchList) => Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      pinch = {distance: Math.max(1, distance(event.touches)), zoom: liveZoom.current};
    };
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      applyZoom(pinch.zoom * distance(event.touches) / pinch.distance, {x: (event.touches[0].clientX + event.touches[1].clientX) / 2, y: (event.touches[0].clientY + event.touches[1].clientY) / 2});
    };
    const end = () => {pinch = null;};
    element.addEventListener('wheel', wheel, {passive: false});
    element.addEventListener('touchstart', start, {passive: false});
    element.addEventListener('touchmove', move, {passive: false});
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', end);
    return () => {
      pending.current = null;
      element.removeEventListener('wheel', wheel); element.removeEventListener('touchstart', start); element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', end);
    };
  }, [root, enabled, blocked]);
  return {changeZoom: change, captureAnchor};
}
