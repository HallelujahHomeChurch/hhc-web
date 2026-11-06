'use client';

import {useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import styles from './mini-player.module.css';

export function PlaybackHost({watchSlot, children, onClose, moveLabel, resizeLabel}: {
  watchSlot: HTMLElement | null;
  children: ReactNode;
  onClose?: () => void;
  moveLabel?: string;
  resizeLabel?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: number; x: number; y: number; width: number; resize: boolean} | null>(null);
  const [left, setLeft] = useState(false);
  const [top, setTop] = useState(false);
  const [width, setWidth] = useState<number>();
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, resize: boolean) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, width: hostRef.current?.offsetWidth ?? 360, resize};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !start.resize) return;
    const delta = event.clientX - start.x;
    setWidth(Math.max(240, Math.min(640, start.width + (left ? delta : -delta))));
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (!start.resize && Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 4) {
      setLeft(event.clientX < window.innerWidth / 2);
      setTop(event.clientY < window.innerHeight / 2);
    }
  };
  const pointerCancel = () => { drag.current = null; };
  useLayoutEffect(() => {
    if (watchSlot || !onClose) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.fullscreenElement &&
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

  return <div ref={hostRef} className={styles.host} data-presentation={watchSlot ? 'watch' : 'mini'}
    data-left={left} data-top={top} style={!watchSlot && width ? {width: `min(${width}px, calc(100vw - 32px))`} : undefined}>
    {children}
    {!watchSlot && moveLabel && <button type="button" className={styles.move} aria-label={moveLabel}
      onPointerDown={event => pointerDown(event, false)} onPointerUp={pointerUp} onPointerCancel={pointerCancel}
      onKeyDown={event => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setLeft(event.key === 'ArrowLeft');
        else setTop(event.key === 'ArrowUp');
      }}>⠿</button>}
    {!watchSlot && resizeLabel && <button type="button" className={styles.resize} aria-label={resizeLabel}
      onPointerDown={event => pointerDown(event, true)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setWidth(value => Math.max(240, Math.min(640, (value ?? 360) + (event.key === 'ArrowRight' ? 16 : -16))));
      }}>◩</button>}
  </div>;
}
