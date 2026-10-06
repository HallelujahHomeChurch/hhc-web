import {useEffect, useEffectEvent, type RefObject} from 'react';

/** Native scrolling remains untouched; only deliberate releases at chapter boundaries navigate. */
export function ChapterPull({root, blocked, onPrevious, onNext}: {root: RefObject<HTMLDivElement | null>; blocked: boolean; onPrevious?: () => void; onNext?: () => void}) {
  const unavailable = useEffectEvent(() => blocked || !!window.getSelection()?.toString() || (window.visualViewport?.scale ?? 1) > 1);
  const navigate = useEffectEvent((previous: boolean) => {if (!unavailable()) (previous ? onPrevious : onNext)?.();});
  useEffect(() => {
    const viewport = root.current;
    if (!viewport) return;
    let start: {id: number; x: number; y: number; top: boolean; bottom: boolean} | null = null;
    const cancel = () => {start = null;};
    const down = (event: TouchEvent) => {
      if (event.touches.length !== 1 || unavailable() || (event.target instanceof Element && event.target.closest('button,input,textarea,a,[contenteditable]'))) {cancel(); return;}
      const touch = event.touches[0];
      start = {id: touch.identifier, x: touch.clientX, y: touch.clientY, top: viewport.scrollTop <= 2, bottom: viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2};
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !start || Math.abs(event.touches[0].clientX - start.x) > 40 || unavailable()) cancel();
    };
    const up = (event: TouchEvent) => {
      const initial = start;
      cancel();
      if (!initial || event.touches.length || unavailable()) return;
      const touch = Array.from(event.changedTouches).find(touch => touch.identifier === initial.id);
      if (!touch || Math.abs(touch.clientX - initial.x) > 40) return;
      const delta = touch.clientY - initial.y;
      if (initial.top && delta >= 72) navigate(true);
      else if (initial.bottom && delta <= -72) navigate(false);
    };
    viewport.addEventListener('touchstart', down, {passive: true});
    viewport.addEventListener('touchmove', move, {passive: true});
    viewport.addEventListener('touchend', up, {passive: true});
    viewport.addEventListener('touchcancel', cancel);
    return () => {
      viewport.removeEventListener('touchstart', down);
      viewport.removeEventListener('touchmove', move);
      viewport.removeEventListener('touchend', up);
      viewport.removeEventListener('touchcancel', cancel);
    };
  }, [root]);
  return null;
}
