import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type {ReaderSentence} from './selection';
import {readTextSelection, rangeQuote, type ReaderTextRange} from './text-range';

export type ReaderSelection = {ids: string[]; ranges?: ReaderTextRange[]};
function clearNativeSelection(root: RefObject<HTMLElement | null>) {
  const element = root.current, native = element?.ownerDocument.getSelection();
  if (native?.anchorNode && element?.contains(native.anchorNode)) native.removeAllRanges();
}
export function useTextSelection(root: RefObject<HTMLElement | null>, sentences: readonly ReaderSentence[], initial: ReaderSelection, locked: boolean) {
  const [selection, update] = useState(() => {
    if (initial.ranges) {try {rangeQuote(initial.ranges, sentences);} catch {return {ids: []} as ReaderSelection;}}
    return initial;
  });
  const [selecting, setSelecting] = useState(false);
  const current = useRef(selection);
  const preserveSnapshot = useRef(initial.ids.length > 0);
  const setSelection = useCallback((next: ReaderSelection) => {current.current = next; preserveSnapshot.current = next.ids.length > 0; update(next); setSelecting(false);}, []);
  const clear = useCallback(() => {
    clearNativeSelection(root);
    setSelection({ids: []});
  }, [root, setSelection]);
  const clearIf = (previous: ReaderSelection) => {if (current.current === previous) clear();};
  useEffect(() => {
    const owner = root.current?.ownerDocument;
    if (!owner || locked) return;
    // A sheet/revalidation may have collapsed the OS selection. Its captured
    // range remains usable until the user starts another gesture or dismisses.
    preserveSnapshot.current = current.current.ids.length > 0;
    let newGesture = false;
    const pointers = new Set<number>();
    let keyboardSelecting = false;
    let touching = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelSettle = () => clearTimeout(settleTimer);
    const settleNative = () => {
      cancelSettle();
      // OS selection handles may emit selectionchange without DOM pointer events.
      if (!pointers.size && !keyboardSelecting && !touching) settleTimer = setTimeout(() => setSelecting(false), 180);
    };
    const changed = () => {
      const native = owner.getSelection();
      if (!root.current) return;
      const ranges = readTextSelection(root.current, native, sentences);
      if (ranges.length) {
        if (newGesture || JSON.stringify(ranges) !== JSON.stringify(current.current.ranges)) {
          const next = {ids: ranges.map(range => range.sentenceId), ranges};
          current.current = next; update(next);
          setSelecting(true);
          settleNative();
        }
        newGesture = false;
      }
      else if (!preserveSnapshot.current) setSelection({ids: []});
    };
    const pointer = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (root.current?.contains(event.target)) {
        if (event.type === 'pointerdown') {newGesture = true; preserveSnapshot.current = false; pointers.add((event as PointerEvent).pointerId); cancelSettle(); setSelecting(true);}
      } else if (event.target.closest('.reader-selection-tools, [data-reader-selection-tools]')) preserveSnapshot.current = true;
      else clear();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
      if (root.current?.contains(event.target as Node) || root.current?.contains(owner.getSelection()?.anchorNode ?? null)) {
        preserveSnapshot.current = false;
        if (event.shiftKey || (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {keyboardSelecting = true; cancelSettle(); setSelecting(true);}
      }
    };
    const released = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      changed();
      if (!pointers.size && !touching) {
        cancelSettle();
        if (event.type === 'pointercancel') settleNative();
        else setSelecting(false);
      }
    };
    const keyReleased = () => {if (keyboardSelecting) {keyboardSelecting = false; changed(); cancelSettle(); setSelecting(false);}};
    const touchStarted = (event: TouchEvent) => {
      if (!root.current?.contains(event.target as Node)) return;
      touching = true; cancelSettle(); setSelecting(true);
    };
    const touchEnded = (event: TouchEvent) => {
      if (!touching || event.touches.length) return;
      touching = false; changed(); cancelSettle();
      if (!pointers.size) setSelecting(false);
    };
    const blurred = () => {pointers.clear(); keyboardSelecting = false; touching = false; cancelSettle(); clear();};
    owner.addEventListener('selectionchange', changed);
    owner.addEventListener('pointerdown', pointer);
    owner.addEventListener('click', pointer);
    owner.addEventListener('keydown', keyboard);
    owner.addEventListener('keyup', keyReleased);
    owner.addEventListener('pointerup', released);
    owner.addEventListener('pointercancel', released);
    owner.addEventListener('touchstart', touchStarted, {passive: true});
    owner.addEventListener('touchend', touchEnded);
    owner.addEventListener('touchcancel', touchEnded);
    owner.defaultView?.addEventListener('blur', blurred);
    return () => {
      cancelSettle();
      owner.removeEventListener('selectionchange', changed); owner.removeEventListener('pointerdown', pointer);
      owner.removeEventListener('click', pointer); owner.removeEventListener('keydown', keyboard);
      owner.removeEventListener('keyup', keyReleased); owner.removeEventListener('pointerup', released); owner.removeEventListener('pointercancel', released);
      owner.removeEventListener('touchstart', touchStarted); owner.removeEventListener('touchend', touchEnded); owner.removeEventListener('touchcancel', touchEnded);
      owner.defaultView?.removeEventListener('blur', blurred);
    };
  }, [root, sentences, locked, clear, setSelection]);
  return {selection, selecting, setSelection, clear, clearIf};
}
