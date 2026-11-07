'use client';
import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import styles from './mini-player.module.css';

export type LibrarySurface = {key: string; render: (active: boolean) => ReactNode};

export function RetainedLibrary({surface, slot, visible, scroll}: {
  surface: LibrarySurface | null; slot: HTMLElement | null; visible: boolean; scroll: number;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const [container] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'));
  useLayoutEffect(() => {
    const target = slot ?? backdrop.current;
    if (container && target) target.append(container);
  }, [container, slot]);
  useLayoutEffect(() => () => { container?.remove(); }, [container]);
  return <>
    <div ref={backdrop} className={styles.libraryBackdrop} hidden={Boolean(slot)} data-visible={visible} inert aria-hidden="true"
      style={{'--library-scroll': `${scroll}px`} as React.CSSProperties}/>
    {container && surface && createPortal(surface.render(Boolean(slot)), container, surface.key)}
  </>;
}
