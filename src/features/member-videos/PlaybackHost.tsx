'use client';

import {useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import {mobileBarChanged} from '@/components/layout/useScrollChrome';
import styles from './mini-player.module.css';
import {miniRect, pullRect, readMiniArea, releaseDockEdge, type DockEdge, type MediaRect, type MiniArea} from './mini-geometry';

export function PlaybackHost({watchSlot, children, dockLabels, onClose, moveLabel, resizeLabel, minimizeOffset = 0, tracking = minimizeOffset !== 0, onSettled, onPullCancel, sessionKey, onCompactChange}: {
  watchSlot: HTMLElement | null;
  children: ReactNode;
  dockLabels?: {hide: string; show: string};
  onClose?: () => void;
  moveLabel?: string;
  resizeLabel?: string;
  minimizeOffset?: number;
  tracking?: boolean;
  onSettled?: () => void;
  onPullCancel?: () => void;
  sessionKey?: string;
  onCompactChange?: (compact: boolean) => void;
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
  const drag = useRef<{id: number; x: number; y: number; width: number; bounds: DOMRect; resize: boolean; moved: boolean; samples: {time: number; x: number}[]} | null>(null);
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
  const [dock, setDock] = useState<{edge: DockEdge; session: typeof sessionKey} | null>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const dockHeight = useRef<number | null>(null);
  const restoreFocus = useRef(false);
  const dockSpeed = useRef(0);
  const dragFrame = useRef(0);
  const docked = Boolean(dock && dockLabels && dock.session === sessionKey && !watchSlot);
  const changeDock = (edge: DockEdge | null, from: MediaRect, speed = 0) => {
    dragRelease.current = from;
    dockSpeed.current = Math.abs(speed);
    dockHeight.current = from.top;
    if (edge) setLeft(edge === 'left');
    setDock(edge ? {edge, session: sessionKey} : null);
    restoreFocus.current = !edge;
  };
  useLayoutEffect(() => {
    if (docked) handle.current?.focus({preventScroll:true});
    else if (restoreFocus.current) {restoreFocus.current=false;hostRef.current?.focus({preventScroll:true});}
  }, [docked]);
  const miniBounds = (bounds: MiniArea, preferred: number, left: boolean, top: boolean) => {
    const host = hostRef.current, compact = bounds.right - bounds.left < 736;
    const caption = compact ? 0 : host?.querySelector<HTMLElement>('[data-mini-caption]')?.getBoundingClientRect().height || 76;
    const panel = compact ? null : host?.querySelector<HTMLElement>('[data-mini-source]:not([hidden])');
    const video = miniRect(bounds, preferred, caption + (panel ? 44 : 0), left, top);
    const sourceHeight = panel ? Math.min(Math.max(44, panel.scrollHeight), 240, Math.max(0, bounds.bottom - bounds.top - caption - video.width * 9 / 16)) : 0;
    host?.style.setProperty('--mini-source-height', `${sourceHeight}px`);
    return miniRect(bounds, video.width, caption + sourceHeight, left, top);
  };
  const clampWidth = (value: number) => {
    const bounds = area.current ?? readMiniArea();
    return miniBounds(bounds, Math.min(640, Math.max(240, value)), left, top).width;
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (docked || watchSlot || hostRef.current?.querySelector('[data-fullscreen]:not([data-fullscreen="inline"])')) { drag.current = null; setOffset({x: 0, y: 0}); return; }
    suppressClick.current = false;
    const target = event.target as HTMLElement;
    const resize = Boolean(target.closest('[data-mini-resize]'));
    if (resize && (area.current ?? readMiniArea()).right - (area.current ?? readMiniArea()).left < 736) return;
    if (!resize && target.closest('button, a, input, select, [role="slider"]') && !target.closest('[data-player-surface]')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (dockLabels && event.currentTarget.dataset.compact === 'true' && transition.current) {
      ++geometryGeneration.current;
      transition.current.cancel(); transition.current = null;
      event.currentTarget.style.left = `${bounds.left}px`;
      event.currentTarget.style.top = `${bounds.top}px`;
    }
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, bounds, resize, moved: false, samples: [{time:event.timeStamp, x:event.clientX}]};
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
    else if (dockLabels && event.currentTarget.dataset.compact === 'true') {
      const bounds = area.current ?? readMiniArea();
      const samples = start.samples;
      if (samples.at(-1)?.x !== event.clientX) samples.push({time:event.timeStamp, x:event.clientX});
      while (samples.length > 1 && samples[0].time < event.timeStamp - 95) samples.shift();
      const host = event.currentTarget;
      const vertical = Math.max(bounds.top-start.bounds.top, Math.min(bounds.bottom-start.bounds.bottom,dy));
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = requestAnimationFrame(() => {
        host.style.transform = `translate3d(${dx}px,${vertical}px,0)`;
      });
    }
    else {const bounds = area.current ?? readMiniArea(); setOffset({x: Math.max(bounds.left - start.bounds.left, Math.min(bounds.right - start.bounds.right, dx)), y: Math.max(bounds.top - start.bounds.top, Math.min(bounds.bottom - start.bounds.bottom, dy))});}
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (start.moved && !start.resize) {
      dragRelease.current = event.currentTarget.getBoundingClientRect();
      const bounds = area.current ?? readMiniArea();
      if (dockLabels && event.currentTarget.dataset.compact === 'true') {
        cancelAnimationFrame(dragFrame.current);
        const dx = event.clientX-start.x, dy = event.clientY-start.y;
        const from = {left:start.bounds.left+dx, top:Math.max(bounds.top,Math.min(bounds.bottom-start.bounds.height,start.bounds.top+dy)), width:start.width,height:start.bounds.height};
        const last = start.samples.at(-1)!;
        const first = start.samples.find(sample => sample.time >= event.timeStamp-95) ?? last;
        const velocity = event.timeStamp-last.time < 75 ? (last.x-first.x)/Math.max(1,last.time-first.time) : 0;
        const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
        const edge = releaseDockEdge({...from, dx, dy, pointerX:event.clientX, velocity, viewportLeft,
          viewportRight:viewportLeft+(window.visualViewport?.width ?? window.innerWidth)});
        event.currentTarget.style.transform = '';
        dragRelease.current = from;
        if (edge) {changeDock(edge,from,velocity);return;}
        dockHeight.current = null;
      }
      setLeft(event.clientX < (bounds.left + bounds.right) / 2);
      setTop(event.clientY < (bounds.top + bounds.bottom) / 2);
    }
    setOffset({x: 0, y: 0});
  };
  const pointerCancel = () => { cancelAnimationFrame(dragFrame.current); if (hostRef.current) hostRef.current.style.transform=''; if (drag.current?.moved) suppressClick.current = true; drag.current = null; setOffset({x: 0, y: 0}); };
  useLayoutEffect(() => {
    const host = hostRef.current;
    const caption = host?.querySelector<HTMLElement>('[data-mini-caption]');
    if (watchSlot || !host || !caption) return;
    const measure = () => {host.style.setProperty('--mini-caption-height', `${caption.getBoundingClientRect().height}px`); arrange.current('slot');};
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
      if (drag.current && dockLabels && reason !== 'viewport' && !watchSlot && lastSession.current === sessionKey) return;
      area.current ??= readMiniArea();
      const bounds = area.current, compact = bounds.right - bounds.left < 736;
      host.dataset.compact = String(compact);
      onCompactChange?.(compact);
      const end = miniBounds(bounds, width ?? (compact ? 240 : 400), left, top);
      const corner = `${left}:${top}`;
      const newSession = lastSession.current !== sessionKey;
      if (newSession) {pull.current = null; invalidPull.current = false;}
      if (newSession || watchSlot || !compact) {
        dockHeight.current = null;
        if (dock) setDock(null);
      }
      const current = host.getBoundingClientRect();
      const previous = dragRelease.current ?? (current.width > 0 ? current : lastBounds.current);
      let changed = Boolean(dragRelease.current) || newSession || lastWatch.current !== Boolean(watchSlot) || !watchSlot && lastCorner.current !== corner;
      let next: MediaRect = watchSlot ? watchSlot.getBoundingClientRect() : end;
      if (!watchSlot && compact && !newSession && dockHeight.current !== null) {
        next = {...next, top:Math.max(bounds.top,Math.min(bounds.bottom-next.height,dockHeight.current))};
        if (docked && dock) {
          const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
          const viewportRight = viewportLeft+(window.visualViewport?.width ?? window.innerWidth);
          next.left = dock.edge === 'left' ? viewportLeft-next.width : viewportRight;
          if (handle.current) {
            handle.current.style.left = dock.edge === 'left' ? `calc(${viewportLeft}px + env(safe-area-inset-left))` : `calc(${viewportRight-44}px - env(safe-area-inset-right))`;
            handle.current.style.top = `${Math.max(bounds.top, Math.min(bounds.bottom-60,next.top+(next.height-60)/2))}px`;
          }
        }
      }
      dragRelease.current = null;
      if (watchSlot && pull.current && (reason === 'viewport' || ['left','top','width','height'].some(key=>next[key as keyof MediaRect] !== pull.current!.start[key as keyof MediaRect]))) {
        invalidPull.current = true; pull.current = null; changed = true; onPullCancel?.();
      }
      if (!tracking) invalidPull.current = false;
      if (watchSlot && tracking && !invalidPull.current) {
        if (!pull.current) pull.current = {start: next, end: miniBounds(bounds, width ?? (compact ? 240 : 400), false, false), dyLock: minimizeOffset};
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
        const edgeMotion = !watchSlot && compact && dockHeight.current !== null;
        const distance = Math.hypot(next.left-previous.left,next.top-previous.top);
        const duration = edgeMotion ? Math.max(180,Math.min(380,170+distance*.45)) : 220;
        const slope = Math.min(3.5,dockSpeed.current*duration/Math.max(1,distance));
        const easing = edgeMotion ? `cubic-bezier(.22,${Math.max(.12,slope*.22)},.22,1)` : 'cubic-bezier(.22,1,.36,1)';
        const animation = host.animate([frame(previous), frame(next)], {duration, easing});
        transition.current = animation;
        animation.onfinish = () => {if (generation === geometryGeneration.current && transition.current === animation) {transition.current = null; onSettled?.();}};
      }
      if (changed && !transition.current) onSettled?.();
      lastBounds.current = next; lastWatch.current = Boolean(watchSlot); lastCorner.current = corner; lastSession.current = sessionKey;
    };
    arrange.current('render');
  });

  useLayoutEffect(() => {
    let frame = 0, viewportChanged = false;
    const queue = (viewport: boolean) => {
      viewportChanged ||= viewport;
      if (!frame && document.visibilityState !== 'hidden') frame = requestAnimationFrame(() => {
        frame = 0;
        let reason: 'viewport' | 'slot' = 'slot';
        if (viewportChanged) {
          bindNavigation();
          const next = readMiniArea(), previous = area.current;
          if (!previous || Object.keys(next).some(key=>next[key as keyof MiniArea] !== previous[key as keyof MiniArea])) reason = 'viewport';
          area.current = next;
          if (reason === 'viewport' && drag.current) {cancelAnimationFrame(dragFrame.current); if(hostRef.current)hostRef.current.style.transform=''; drag.current = null; setOffset({x:0,y:0});}
        }
        viewportChanged = false;
        arrange.current(reason);
      });
    };
    queue(true);
    const viewport = () => queue(true), measure = () => queue(false);
    let nav: Element | null = null;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries=>queue(entries.some(entry=>entry.target===nav)));
    if (watchSlot) observer?.observe(watchSlot);
    const mutation = new MutationObserver(viewport);
    function detachNavigation() {
      if (nav) observer?.unobserve(nav);
      mutation.disconnect();
      for (const name of ['transitionend','focusin','focusout']) nav?.removeEventListener(name, viewport);
    }
    function bindNavigation() {
      const current = document.querySelector('.site-mobile-tab-bar');
      if (current === nav) return;
      detachNavigation();
      nav = current;
      if (!nav) return;
      observer?.observe(nav);
      mutation.observe(nav, {attributes:true, attributeFilter:['style','class','data-mobile-hidden']});
      for (const name of ['transitionend','focusin','focusout']) nav.addEventListener(name, viewport);
    }
    bindNavigation();
    window.addEventListener(mobileBarChanged, viewport);
    window.addEventListener('resize', viewport); window.addEventListener('scroll', measure, {capture:true,passive:true});
    window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport);
    document.addEventListener('visibilitychange', viewport);
    return () => {cancelAnimationFrame(frame); detachNavigation(); window.removeEventListener(mobileBarChanged, viewport); observer?.disconnect(); window.removeEventListener('resize', viewport); window.removeEventListener('scroll', measure, true); window.visualViewport?.removeEventListener('resize', viewport); window.visualViewport?.removeEventListener('scroll', viewport); document.removeEventListener('visibilitychange', viewport);};
  }, [watchSlot]);
  useLayoutEffect(() => () => {transition.current?.cancel();cancelAnimationFrame(dragFrame.current);}, []);

  return <><div inert={docked || undefined} ref={hostRef} className={styles.host} data-presentation={watchSlot ? 'watch' : 'mini'}
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
      dockHeight.current = null;
      if (event.shiftKey) setWidth(value => clampWidth((value ?? (hostRef.current?.getBoundingClientRect().width || 400)) + (['ArrowRight','ArrowUp'].includes(event.key) ? 16 : -16)));
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setLeft(event.key === 'ArrowLeft');
      else setTop(event.key === 'ArrowUp');
    }}
    style={{transform: !watchSlot && (offset.x || offset.y) ? `translate(${offset.x}px, ${offset.y}px)` : undefined}}>
    {children}
    {dockLabels && !watchSlot && <button type="button" className={styles.stow} aria-label={dockLabels.hide}
      onClick={() => {const host=hostRef.current;if(host)changeDock(left?'left':'right',host.getBoundingClientRect());}}>{left?'‹':'›'}</button>}
    {!watchSlot && resizeLabel && <button type="button" data-mini-resize className={styles.resize} aria-label={resizeLabel}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setWidth(value => clampWidth((value ?? (hostRef.current?.getBoundingClientRect().width || 400)) + (event.key === 'ArrowRight' ? 16 : -16)));
      }}/>}
  </div>
  {docked && dock && dockLabels && <button type="button" ref={handle} className={styles.edgeHandle} data-edge={dock.edge}
    aria-label={dockLabels.show} onClick={() => {const host=hostRef.current;if(host)changeDock(null,host.getBoundingClientRect());}}>
    {dock.edge==='left'?'›':'‹'}
  </button>}</>;
}
