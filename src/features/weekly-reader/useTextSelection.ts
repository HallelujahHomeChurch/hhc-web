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
  const current = useRef(selection);
  const preserveSnapshot = useRef(initial.ids.length > 0);
  const setSelection = useCallback((next: ReaderSelection) => {current.current = next; preserveSnapshot.current = next.ids.length > 0; update(next);}, []);
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
    const changed = () => {
      const native = owner.getSelection();
      if (!root.current) return;
      const ranges = readTextSelection(root.current, native, sentences);
      if (ranges.length) {
        if (newGesture || JSON.stringify(ranges) !== JSON.stringify(current.current.ranges)) {
          const next = {ids: ranges.map(range => range.sentenceId), ranges};
          current.current = next; update(next);
        }
        newGesture = false;
      }
      else if (!preserveSnapshot.current) setSelection({ids: []});
    };
    const pointer = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (root.current?.contains(event.target)) {
        if (event.type === 'pointerdown') {newGesture = true; preserveSnapshot.current = false;}
      } else if (event.target.closest('.reader-selection-tools, [data-reader-selection-tools]')) preserveSnapshot.current = true;
      else clear();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
      if (root.current?.contains(event.target as Node)) preserveSnapshot.current = false;
    };
    owner.addEventListener('selectionchange', changed);
    owner.addEventListener('pointerdown', pointer);
    owner.addEventListener('click', pointer);
    owner.addEventListener('keydown', keyboard);
    return () => {
      owner.removeEventListener('selectionchange', changed); owner.removeEventListener('pointerdown', pointer);
      owner.removeEventListener('click', pointer); owner.removeEventListener('keydown', keyboard);
    };
  }, [root, sentences, locked, clear, setSelection]);
  return {selection, setSelection, clear, clearIf};
}
