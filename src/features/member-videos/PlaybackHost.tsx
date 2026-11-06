'use client';

import {useLayoutEffect, useRef, type ReactNode} from 'react';
import styles from './mini-player.module.css';

export function PlaybackHost({watchSlot, children}: {watchSlot: HTMLElement | null; children: ReactNode}) {
  const hostRef = useRef<HTMLDivElement>(null);

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

  return <div ref={hostRef} className={styles.host} data-presentation={watchSlot ? 'watch' : 'mini'}>{children}</div>;
}
