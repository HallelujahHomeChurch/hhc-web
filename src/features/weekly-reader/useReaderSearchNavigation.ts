import {useEffect, useEffectEvent, useRef, type RefObject} from 'react';

type Activation = {id: string; start?: number; pointer: number; x: number; y: number; rect: DOMRect; binding: string};

export function useReaderSearchNavigation({root, open, suspended, binding, allowAction, onJump, offline = false}: {
  root: RefObject<HTMLElement | null>; open: boolean; suspended: boolean; binding: string;
  allowAction: () => boolean; onJump: (id: string, start?: number) => void;
  offline?: boolean;
}) {
  const activation = useRef<Activation | null>(null);
  const pending = useRef<{id: string; start?: number; binding: string} | null>(null);
  const consumed = useRef<string | null>(null);
  const jump = (id: string, start?: number) => {
    if (!open || suspended || !allowAction() || consumed.current === id) return;
    const input = root.current?.querySelector<HTMLInputElement>('.reader-search input');
    input?.blur();
    if (start === undefined) onJump(id); else onJump(id, start);
  };
  const capture = useEffectEvent((event: PointerEvent) => {
    if (event.type === 'pointerdown') {
      consumed.current = null;
      if (activation.current || !event.isPrimary || event.button !== 0) {activation.current = null; return;}
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-reader-search-target]') : null;
      if (!open || suspended || !target || !root.current?.contains(target) || !allowAction()) return;
      activation.current = {id: target.dataset.readerSearchTarget!, start: target.dataset.readerSearchStart === undefined ? undefined : Number(target.dataset.readerSearchStart), pointer: event.pointerId, x: event.clientX, y: event.clientY, rect: target.getBoundingClientRect(), binding};
      return;
    }
    const started = activation.current;
    activation.current = null;
    if (event.type !== 'pointerup' || !started || !suspended || !open || started.binding !== binding || started.pointer !== event.pointerId || !event.isPrimary) return;
    const {rect} = started;
    if (Math.hypot(event.clientX - started.x, event.clientY - started.y) > 8 || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    // Capture a completed tap outside the inert reader; authorization still gates execution.
    pending.current = {id: started.id, start: started.start, binding}; consumed.current = started.id;
  });
  const resume = useEffectEvent(() => {
    const intent = pending.current;
    if (!intent || suspended) return;
    pending.current = null;
    if (!open || offline || intent.binding !== binding || !allowAction()) return;
    const target = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-reader-search-target]') ?? []).find(element => element.dataset.readerSearchTarget === intent.id);
    if (target && (intent.start === undefined || Number(target.dataset.readerSearchStart) === intent.start)) {
      root.current?.querySelector<HTMLInputElement>('.reader-search input')?.blur();
      if (intent.start === undefined) onJump(intent.id); else onJump(intent.id, intent.start);
    }
  });
  useEffect(() => {resume();}, [suspended, open, binding, offline]);
  useEffect(() => {
    const cancel = () => {activation.current = null; pending.current = null;};
    const listener = (event: PointerEvent) => capture(event);
    window.addEventListener('pointerdown', listener, true);
    window.addEventListener('pointerup', listener, true);
    window.addEventListener('pointercancel', listener, true);
    window.addEventListener('scroll', cancel, true); window.addEventListener('resize', cancel); window.addEventListener('blur', cancel);
    return () => {
      cancel(); consumed.current = null;
      window.removeEventListener('pointerdown', listener, true); window.removeEventListener('pointerup', listener, true); window.removeEventListener('pointercancel', listener, true);
      window.removeEventListener('scroll', cancel, true); window.removeEventListener('resize', cancel); window.removeEventListener('blur', cancel);
    };
  }, []);
  useEffect(() => {activation.current = null; pending.current = null; consumed.current = null;}, [binding, open]);
  return jump;
}
