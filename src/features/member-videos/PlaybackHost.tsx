'use client';

import {useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import styles from './mini-player.module.css';

export function PlaybackHost({watchSlot, children, onClose, moveLabel, resizeLabel, minimizeOffset = 0, onSettled}: {
  watchSlot: HTMLElement | null;
  children: ReactNode;
  onClose?: () => void;
  moveLabel?: string;
  resizeLabel?: string;
  minimizeOffset?: number;
  onSettled?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastBounds = useRef<DOMRect | null>(null);
  const lastWatch = useRef(Boolean(watchSlot));
  const lastCorner = useRef('false:false');
  const transition = useRef<Animation | null>(null);
  const drag = useRef<{id: number; x: number; y: number; width: number; bounds: DOMRect; resize: boolean; moved: boolean} | null>(null);
  const suppressClick = useRef(false);
  const [left, setLeft] = useState(false), [top, setTop] = useState(false);
  const [width, setWidth] = useState<number>();
  const [offset, setOffset] = useState({x: 0, y: 0});
  const clampWidth = (value: number) => Math.max(0, Math.min(Math.max(240, value), 640, window.innerWidth - 32, (window.innerHeight - 32 - (window.matchMedia?.('(pointer: coarse)').matches ? 0 : 44)) * 16 / 9));
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (watchSlot || hostRef.current?.querySelector('[data-fullscreen]:not([data-fullscreen="inline"])') || !event.isPrimary || event.button !== 0) { drag.current = null; setOffset({x: 0, y: 0}); return; }
    suppressClick.current = false;
    const target = event.target as HTMLElement;
    const resize = Boolean(target.closest('[data-mini-resize]'));
    if (resize && window.matchMedia?.('(pointer: coarse)').matches) return;
    if (!resize && target.closest('button, a, input, select, [role="slider"]') && !target.closest('[data-player-surface]')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, bounds, resize, moved: false};
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 6) return;
    start.moved = true;
    suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (start.resize) setWidth(clampWidth(start.width + (left ? dx : -dx)));
    else setOffset({x: Math.max(16 - start.bounds.left, Math.min(window.innerWidth - 16 - start.bounds.right, dx)), y: Math.max(16 - start.bounds.top, Math.min(window.innerHeight - 16 - start.bounds.bottom, dy))});
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (start.moved && !start.resize) {
      setLeft(event.clientX < window.innerWidth / 2);
      setTop(event.clientY < window.innerHeight / 2);
    }
    setOffset({x: 0, y: 0});
  };
  const pointerCancel = () => { if (drag.current?.moved) suppressClick.current = true; drag.current = null; setOffset({x: 0, y: 0}); };
  useLayoutEffect(() => {
    if (watchSlot || !onClose) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.fullscreenElement &&
        !hostRef.current?.querySelector('[data-fullscreen]:not([data-fullscreen="inline"])') &&
        !document.querySelector('[aria-modal="true"], dialog[open]')) onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [watchSlot, onClose]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !watchSlot) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (document.visibilityState === 'hidden') return;
      const {left, top, width, height} = watchSlot.getBoundingClientRect();
      host.style.setProperty('--watch-left', `${left}px`);
      host.style.setProperty('--watch-top', `${top}px`);
      host.style.setProperty('--watch-width', `${width}px`);
      host.style.setProperty('--watch-height', `${height}px`);
      if (lastWatch.current === Boolean(watchSlot)) lastBounds.current = host.getBoundingClientRect();
    };
    const queueMeasure = () => {
      if (!frame && document.visibilityState !== 'hidden') frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queueMeasure);
    observer?.observe(watchSlot);
    window.addEventListener('scroll', queueMeasure, {capture: true, passive: true});
    window.addEventListener('resize', queueMeasure);
    window.visualViewport?.addEventListener('resize', queueMeasure);
    window.visualViewport?.addEventListener('scroll', queueMeasure);
    document.addEventListener('visibilitychange', queueMeasure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', queueMeasure, true);
      window.removeEventListener('resize', queueMeasure);
      window.visualViewport?.removeEventListener('resize', queueMeasure);
      window.visualViewport?.removeEventListener('scroll', queueMeasure);
      document.removeEventListener('visibilitychange', queueMeasure);
    };
  }, [watchSlot]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !watchSlot) return;
    const sync = () => {
      const theater = host.querySelector('[data-theater="true"]') !== null;
      if (host.dataset.theater !== String(theater)) host.dataset.theater = String(theater);
      watchSlot.setAttribute('data-theater', String(theater));
    };
    const observer = new MutationObserver(sync);
    observer.observe(host, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-theater']});
    sync();
    return () => { observer.disconnect(); watchSlot.removeAttribute('data-theater'); host.removeAttribute('data-theater'); };
  }, [watchSlot]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const corner = `${left}:${top}`;
    const changed = lastWatch.current !== Boolean(watchSlot) || !watchSlot && lastCorner.current !== corner;
    if (changed) { transition.current?.cancel(); transition.current = null; }
    const next = host.getBoundingClientRect(), previous = lastBounds.current;
    if (changed && previous && previous.width > 0 && next.width > 0 && host.animate &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
      !host.querySelector('[data-fullscreen]:not([data-fullscreen="inline"])')) {
      transition.current = host.animate([
        {transformOrigin: 'top left', transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px) scale(${previous.width / next.width})`},
        {transformOrigin: 'top left', transform: 'none'},
      ], {duration: 220, easing: 'cubic-bezier(.22,1,.36,1)'});
      transition.current.onfinish = () => { transition.current = null; onSettled?.(); };
    }
    if (changed && !transition.current) onSettled?.();
    lastBounds.current = next;
    lastWatch.current = Boolean(watchSlot);
    lastCorner.current = corner;
  }, [watchSlot, minimizeOffset, offset.x, offset.y, width, left, top, onSettled]);
  useLayoutEffect(() => () => transition.current?.cancel(), []);

  return <div ref={hostRef} className={styles.host} data-presentation={watchSlot ? 'watch' : 'mini'}
    data-left={left} data-top={top} data-dragging={Boolean(offset.x || offset.y || minimizeOffset)}
    aria-keyshortcuts={!watchSlot ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight' : undefined}
    role={!watchSlot ? 'group' : undefined} aria-label={!watchSlot ? moveLabel : undefined} tabIndex={!watchSlot ? 0 : undefined}
    onPointerDownCapture={pointerDown} onPointerMoveCapture={pointerMove} onPointerUpCapture={pointerUp} onPointerCancel={pointerCancel}
    onLostPointerCapture={event => { if (event.target === event.currentTarget && drag.current?.id === event.pointerId) pointerCancel(); }}
    onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
    onKeyDown={event => {
      if (watchSlot || event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (event.shiftKey && window.matchMedia?.('(pointer: coarse)').matches) return;
      if (event.shiftKey) setWidth(value => clampWidth((value ?? 360) + (['ArrowRight','ArrowUp'].includes(event.key) ? 16 : -16)));
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setLeft(event.key === 'ArrowLeft');
      else setTop(event.key === 'ArrowUp');
    }}
    style={{...(!watchSlot && width ? {width: `min(${width}px, calc(100vw - 32px), calc((100dvh - 32px - var(--mini-caption-height)) * 16 / 9))`} : {}),
      transform: watchSlot ? (minimizeOffset ? `translateY(${minimizeOffset}px) scale(${Math.max(.6, 1 - minimizeOffset / 800)})` : undefined) : (offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined)}}>
    {children}
    {!watchSlot && resizeLabel && <button type="button" data-mini-resize className={styles.resize} aria-label={resizeLabel}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setWidth(value => clampWidth((value ?? 360) + (event.key === 'ArrowRight' ? 16 : -16)));
      }}/>}
  </div>;
}
