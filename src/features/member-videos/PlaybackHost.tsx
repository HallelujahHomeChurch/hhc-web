'use client';

import {useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import styles from './mini-player.module.css';
import {miniRect, pullRect, readMiniArea, type MediaRect, type MiniArea} from './mini-geometry';

export function PlaybackHost({watchSlot, children, onClose, moveLabel, resizeLabel, minimizeOffset = 0, tracking = minimizeOffset !== 0, onSettled, onPullCancel, sessionKey}: {
  watchSlot: HTMLElement | null;
  children: ReactNode;
  onClose?: () => void;
  moveLabel?: string;
  resizeLabel?: string;
  minimizeOffset?: number;
  tracking?: boolean;
  onSettled?: () => void;
  onPullCancel?: () => void;
  sessionKey?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRelease = useRef<MediaRect | null>(null);
  const lastBounds = useRef<MediaRect | null>(null);
  const area = useRef<MiniArea | null>(null);
  const pull = useRef<{start: MediaRect; end: MediaRect; dyLock: number} | null>(null);
  const invalidPull = useRef(false), geometryGeneration = useRef(0), lastSession = useRef(sessionKey);
  const arrange = useRef<(reason: 'render' | 'slot' | 'viewport') => void>(() => {});
  const lastWatch = useRef(Boolean(watchSlot));
  const lastCorner = useRef('false:false');
  const transition = useRef<Animation | null>(null);
  const drag = useRef<{id: number; x: number; y: number; width: number; bounds: DOMRect; resize: boolean; moved: boolean} | null>(null);
  const suppressClick = useRef(false);
  const keyboardIntent = useRef(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  useLayoutEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Tab' || hostRef.current?.contains(event.target as Node)) {
        keyboardIntent.current = true;
        if (hostRef.current?.contains(document.activeElement)) setKeyboardFocus(true);
      }
    };
    const pointer = () => { keyboardIntent.current = false; setKeyboardFocus(false); };
    const focus = (event: FocusEvent) => {
      const within = Boolean(hostRef.current?.contains(event.target as Node));
      const fromHost = Boolean(hostRef.current?.contains(event.relatedTarget instanceof Node ? event.relatedTarget : null));
      const keyboard = keyboardIntent.current;
      keyboardIntent.current = false;
      setKeyboardFocus(current => within && (keyboard || current && fromHost));
    };
    const blur = (event: FocusEvent) => {
      if (hostRef.current?.contains(event.target as Node) && !hostRef.current.contains(event.relatedTarget instanceof Node ? event.relatedTarget : null)) setKeyboardFocus(false);
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('focusout', blur, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', pointer, true); document.removeEventListener('focusin', focus, true); document.removeEventListener('focusout', blur, true); };
  }, []);
  const [left, setLeft] = useState(false), [top, setTop] = useState(false);
  const [width, setWidth] = useState<number>();
  const [wasWatch, setWasWatch] = useState(Boolean(watchSlot));
  if (wasWatch !== Boolean(watchSlot)) {
    setWasWatch(Boolean(watchSlot));
    if (!watchSlot && minimizeOffset > 0) {setLeft(false); setTop(false);}
  }
  const [offset, setOffset] = useState({x: 0, y: 0});
  const clampWidth = (value: number) => {
    const bounds = area.current ?? readMiniArea();
    const compact = bounds.right - bounds.left < 736;
    const caption = compact ? 0 : hostRef.current?.querySelector<HTMLElement>('[data-mini-caption]')?.getBoundingClientRect().height || 76;
    return miniRect(bounds, Math.min(640, Math.max(240, value)), caption, left, top).width;
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (watchSlot || hostRef.current?.querySelector('[data-fullscreen]:not([data-fullscreen="inline"])') || !event.isPrimary || event.button !== 0) { drag.current = null; setOffset({x: 0, y: 0}); return; }
    suppressClick.current = false;
    const target = event.target as HTMLElement;
    const resize = Boolean(target.closest('[data-mini-resize]'));
    if (resize && (area.current ?? readMiniArea()).right - (area.current ?? readMiniArea()).left < 736) return;
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
    else {const bounds = area.current ?? readMiniArea(); setOffset({x: Math.max(bounds.left - start.bounds.left, Math.min(bounds.right - start.bounds.right, dx)), y: Math.max(bounds.top - start.bounds.top, Math.min(bounds.bottom - start.bounds.bottom, dy))});}
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (start.moved && !start.resize) {
      dragRelease.current = event.currentTarget.getBoundingClientRect();
      const bounds = area.current ?? readMiniArea();
      setLeft(event.clientX < (bounds.left + bounds.right) / 2);
      setTop(event.clientY < (bounds.top + bounds.bottom) / 2);
    }
    setOffset({x: 0, y: 0});
  };
  const pointerCancel = () => { if (drag.current?.moved) suppressClick.current = true; drag.current = null; setOffset({x: 0, y: 0}); };
  useLayoutEffect(() => {
    const host = hostRef.current;
    const caption = host?.querySelector<HTMLElement>('[data-mini-caption]');
    if (watchSlot || !host || !caption) return;
    const measure = () => host.style.setProperty('--mini-caption-height', `${caption.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(caption);
    return () => { observer?.disconnect(); host.style.removeProperty('--mini-caption-height'); };
  }, [watchSlot]);
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
    arrange.current = reason => {
      const host = hostRef.current;
      if (!host) return;
      area.current ??= readMiniArea();
      const bounds = area.current, compact = bounds.right - bounds.left < 736;
      const caption = compact ? 0 : host.querySelector<HTMLElement>('[data-mini-caption]')?.getBoundingClientRect().height || 76;
      const end = miniRect(bounds, width ?? (compact ? 240 : 400), caption, left, top);
      const corner = `${left}:${top}`;
      const newSession = lastSession.current !== sessionKey;
      if (newSession) {pull.current = null; invalidPull.current = false;}
      const current = host.getBoundingClientRect();
      const previous = dragRelease.current ?? (current.width > 0 ? current : lastBounds.current);
      let changed = Boolean(dragRelease.current) || newSession || lastWatch.current !== Boolean(watchSlot) || !watchSlot && lastCorner.current !== corner;
      let next: MediaRect = watchSlot ? watchSlot.getBoundingClientRect() : end;
      dragRelease.current = null;
      if (watchSlot && pull.current && (reason === 'viewport' || ['left','top','width','height'].some(key=>next[key as keyof MediaRect] !== pull.current!.start[key as keyof MediaRect]))) {
        invalidPull.current = true; pull.current = null; changed = true; onPullCancel?.();
      }
      if (!tracking) invalidPull.current = false;
      if (watchSlot && tracking && !invalidPull.current) {
        if (!pull.current) pull.current = {start: next, end: miniRect(bounds, width ?? (compact ? 240 : 400), caption, false, false), dyLock: minimizeOffset};
        next = pullRect(pull.current.start, pull.current.end, minimizeOffset, pull.current.dyLock);
      } else if (pull.current) {
        pull.current = null;
        if (watchSlot) changed = true;
      }
      if (!watchSlot && reason === 'viewport') changed = true;
      if (changed || watchSlot && tracking) {++geometryGeneration.current; transition.current?.cancel(); transition.current = null;}
      host.style.left = `${next.left}px`; host.style.top = `${next.top}px`;
      host.style.width = `${next.width}px`; host.style.height = `${next.height}px`;
      host.style.right = 'auto'; host.style.bottom = 'auto';
      host.style.setProperty('--mini-available-height', `${bounds.bottom - bounds.top}px`);
      host.dataset.compact = String(compact);
      if (changed && !newSession && previous && previous.width > 0 && previous.height > 0 && next.width > 0 && next.height > 0 && host.animate &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
        !host.querySelector('[data-fullscreen]:not([data-fullscreen="inline"])')) {
        const generation = geometryGeneration.current;
        const frame = (rect: MediaRect) => ({left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
        const animation = host.animate([frame(previous), frame(next)], {duration: 220, easing: 'cubic-bezier(.22,1,.36,1)'});
        transition.current = animation;
        animation.onfinish = () => {if (generation === geometryGeneration.current && transition.current === animation) {transition.current = null; onSettled?.();}};
      }
      if (changed && !transition.current) onSettled?.();
      lastBounds.current = next; lastWatch.current = Boolean(watchSlot); lastCorner.current = corner; lastSession.current = sessionKey;
    };
    arrange.current('render');
  }, [watchSlot, minimizeOffset, width, left, top, offset.x, offset.y, tracking, onSettled, onPullCancel, sessionKey]);

  useLayoutEffect(() => {
    let frame = 0, viewportChanged = false;
    const queue = (viewport: boolean) => {
      viewportChanged ||= viewport;
      if (!frame && document.visibilityState !== 'hidden') frame = requestAnimationFrame(() => {
        frame = 0;
        let reason: 'viewport' | 'slot' = 'slot';
        if (viewportChanged) {
          const next = readMiniArea(), previous = area.current;
          if (!previous || Object.keys(next).some(key=>next[key as keyof MiniArea] !== previous[key as keyof MiniArea])) reason = 'viewport';
          area.current = next;
          if (reason === 'viewport' && drag.current) {drag.current = null; setOffset({x:0,y:0});}
        }
        viewportChanged = false;
        arrange.current(reason);
      });
    };
    const viewport = () => queue(true), measure = () => queue(false);
    const nav = document.querySelector('.site-mobile-tab-bar');
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries=>queue(entries.some(entry=>entry.target===nav)));
    if (nav) observer?.observe(nav);
    if (watchSlot) observer?.observe(watchSlot);
    const mutation = nav ? new MutationObserver(viewport) : null;
    if (nav) mutation?.observe(nav, {attributes:true, attributeFilter:['style','class','data-mobile-hidden']});
    nav?.addEventListener('transitionend', viewport); nav?.addEventListener('focusin', viewport); nav?.addEventListener('focusout', viewport);
    window.addEventListener('resize', viewport); window.addEventListener('scroll', measure, {capture:true,passive:true});
    window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport);
    document.addEventListener('visibilitychange', viewport);
    return () => {cancelAnimationFrame(frame); nav?.removeEventListener('transitionend', viewport); nav?.removeEventListener('focusin', viewport); nav?.removeEventListener('focusout', viewport); observer?.disconnect(); mutation?.disconnect(); window.removeEventListener('resize', viewport); window.removeEventListener('scroll', measure, true); window.visualViewport?.removeEventListener('resize', viewport); window.visualViewport?.removeEventListener('scroll', viewport); document.removeEventListener('visibilitychange', viewport);};
  }, [watchSlot]);
  useLayoutEffect(() => () => transition.current?.cancel(), []);

  return <div ref={hostRef} className={styles.host} data-presentation={watchSlot ? 'watch' : 'mini'}
    data-keyboard-focus={keyboardFocus} data-left={left} data-top={top} data-dragging={Boolean(offset.x || offset.y || tracking)}
    aria-keyshortcuts={!watchSlot ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight' : undefined}
    role={!watchSlot ? 'group' : undefined} aria-label={!watchSlot ? moveLabel : undefined} tabIndex={!watchSlot ? 0 : undefined}
    onPointerDownCapture={pointerDown} onPointerMoveCapture={pointerMove} onPointerUpCapture={pointerUp} onPointerCancel={pointerCancel}
    onLostPointerCapture={event => { if (event.target === event.currentTarget && drag.current?.id === event.pointerId) pointerCancel(); }}
    onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
    onKeyDown={event => {
      if (watchSlot || event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (event.shiftKey && hostRef.current?.dataset.compact === 'true') return;
      if (event.shiftKey) setWidth(value => clampWidth((value ?? (hostRef.current?.getBoundingClientRect().width || 400)) + (['ArrowRight','ArrowUp'].includes(event.key) ? 16 : -16)));
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setLeft(event.key === 'ArrowLeft');
      else setTop(event.key === 'ArrowUp');
    }}
    style={{transform: !watchSlot && (offset.x || offset.y) ? `translate(${offset.x}px, ${offset.y}px)` : undefined}}>
    {children}
    {!watchSlot && resizeLabel && <button type="button" data-mini-resize className={styles.resize} aria-label={resizeLabel}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setWidth(value => clampWidth((value ?? (hostRef.current?.getBoundingClientRect().width || 400)) + (event.key === 'ArrowRight' ? 16 : -16)));
      }}/>}
  </div>;
}
