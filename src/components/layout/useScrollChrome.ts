'use client';
import {useEffect, useEffectEvent, useRef, useState, type RefObject} from 'react';

/** Shared website/reader chrome policy; root omitted means document scrolling. */
export function useScrollChrome({root, blocked = false, resetKey}: {root?: RefObject<HTMLElement | null>; blocked?: boolean; resetKey?: string} = {}) {
  const [state, setState] = useState({key: resetKey, visible: true});
  const ignored = useRef(false);
  const isBlocked = useEffectEvent(() => blocked);
  const reveal = () => {ignored.current = true; setState({key: resetKey, visible: true});};
  useEffect(() => {
    const target = root?.current ?? window;
    const position = () => Math.max(0, root?.current?.scrollTop ?? window.scrollY);
    let previous = position(), direction = 0, distance = 0, frame = 0;
    const intent = () => {if (ignored.current) {ignored.current = false; previous = position(); distance = 0;}};
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const current = position(), delta = current - previous, next = Math.sign(delta);
        previous = current;
        if (ignored.current || isBlocked()) {direction = 0; distance = 0; frame = 0; return;}
        if (next && next !== direction) {direction = next; distance = 0;}
        distance += Math.abs(delta);
        if (current <= 16 || distance >= 16) {
          setState({key: resetKey, visible: current <= 16 || direction < 0}); distance = 0;
        }
        frame = 0;
      });
    };
    target.addEventListener('scroll', scroll, {passive: true});
    for (const event of ['wheel', 'touchmove', 'keydown', 'pointerdown']) target.addEventListener(event, intent, {passive: true});
    return () => {
      target.removeEventListener('scroll', scroll);
      for (const event of ['wheel', 'touchmove', 'keydown', 'pointerdown']) target.removeEventListener(event, intent);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root, resetKey]);
  return {visible: blocked || state.key !== resetKey || state.visible, reveal};
}
