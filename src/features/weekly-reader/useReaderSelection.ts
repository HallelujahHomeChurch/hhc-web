import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import {toggleSentence, type ReaderSentence} from './selection';
import {readTextSelection, rangeQuote, type ReaderTextRange} from './text-range';

export type ReaderSelection = {ids: string[]; ranges?: ReaderTextRange[]};
function clearNativeSelection(root: RefObject<HTMLElement | null>) {
  const element = root.current, native = element?.ownerDocument.getSelection();
  if (native?.anchorNode && element?.contains(native.anchorNode)) native.removeAllRanges();
}
export function useReaderSelection(root: RefObject<HTMLElement | null>, sentences: readonly ReaderSentence[], initial: ReaderSelection, locked: boolean, mode: 'text' | 'sentence' = 'text') {
  const [selection, update] = useState(() => {
    if (initial.ranges) {try {rangeQuote(initial.ranges, sentences);} catch {return {ids: []} as ReaderSelection;}}
    return initial;
  });
  const [selecting, setSelecting] = useState(false);
  const current = useRef(selection);
  const preserve = useRef(initial.ids.length > 0);
  const setSelection = useCallback((next: ReaderSelection) => {current.current = next; preserve.current = next.ids.length > 0; update(next); setSelecting(false);}, []);
  const clear = useCallback(() => {
    clearNativeSelection(root);
    setSelection({ids: []});
  }, [root, setSelection]);
  const clearIf = (previous: ReaderSelection) => {if (current.current === previous) clear();};
  const previousMode = useRef(mode);
  useEffect(() => {
    if (locked) return;
    if (previousMode.current !== mode) clear();
    previousMode.current = mode;
  }, [mode, locked, clear]);
  useEffect(() => {
    const element = root.current, owner = element?.ownerDocument;
    if (!element || !owner || locked) return;
    const tool = (target: Element) => target.closest('.reader-selection-tools, [data-reader-selection-tools]') && !element.contains(target);
    let origin: {x: number; y: number} | null = null, moved = false, pendingTap: ReaderSelection | null = null;
    const move = (event: MouseEvent) => {if (origin && Math.hypot(event.clientX-origin.x, event.clientY-origin.y) > 6) moved = true;};
    const blur = () => clear();
    if (mode === 'sentence') {
      const start = (event: PointerEvent) => {
        origin = {x:event.clientX, y:event.clientY}; moved = false;
        if (event.target instanceof Element && !element.contains(event.target) && !tool(event.target)) clear();
      };
      const cancel = () => {moved = true;};
      const click = (event: MouseEvent) => {
        if (!(event.target instanceof Element) || tool(event.target)) return;
        if (!element.contains(event.target)) {clear(); return;}
        if (moved) {moved=false; origin=null; return;}
        if (event.target.closest('button,a,input,textarea,select,[contenteditable]')) return;
        const sentence = event.target.closest<HTMLElement>('[data-sentence-id]');
        const id = sentence?.dataset.sentenceId;
        if (id && element.contains(sentence)) setSelection({ids:toggleSentence(current.current.ids,id,sentences)});
        else clear();
        origin = null;
      };
      const key = (event: KeyboardEvent) => {
        if (event.key === 'Escape') clear();
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-sentence-id]') : null;
        if (target && element.contains(target) && target.dataset.sentenceId) {event.preventDefault(); setSelection({ids:toggleSentence(current.current.ids,target.dataset.sentenceId,sentences)});}
      };
      owner.addEventListener('pointerdown',start,true);owner.addEventListener('pointermove',move,true);
      owner.addEventListener('pointerup',move,true);owner.addEventListener('pointercancel',cancel,true);
      owner.addEventListener('click',click);owner.addEventListener('keydown',key);
      owner.defaultView?.addEventListener('blur',blur);
      return () => {
        owner.removeEventListener('pointerdown',start,true);owner.removeEventListener('pointermove',move,true);
        owner.removeEventListener('pointerup',move,true);owner.removeEventListener('pointercancel',cancel,true);
        owner.removeEventListener('click',click);owner.removeEventListener('keydown',key);owner.defaultView?.removeEventListener('blur',blur);
      };
    }
    preserve.current = current.current.ids.length > 0;
    const pointers = new Set<number>();
    let keyboardSelecting = false, newGesture = false, timer: ReturnType<typeof setTimeout> | undefined;
    const cancelSettle = () => clearTimeout(timer);
    const dismiss = () => {pointers.clear(); keyboardSelecting=false; pendingTap=null; origin=null; cancelSettle(); clear();};
    const settle = () => {cancelSettle(); if (!pointers.size && !keyboardSelecting) timer=setTimeout(()=>setSelecting(false),180);};
    const changed = (event?: Event) => {
      const ranges = readTextSelection(element,owner.getSelection(),sentences);
      if (ranges.length) {
        if (event?.type === 'selectionchange' && newGesture || JSON.stringify(ranges) !== JSON.stringify(current.current.ranges)) {
          const next={ids:ranges.map(range=>range.sentenceId),ranges};current.current=next;update(next);setSelecting(true);
        }
        settle();if (event?.type === 'selectionchange') newGesture=false;
      } else if (!preserve.current) setSelection({ids:[]});
    };
    const start = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (element.contains(event.target) && (event.button === undefined || event.button === 0)) {
        pendingTap=current.current;origin={x:event.clientX,y:event.clientY};moved=false;
        newGesture=true;preserve.current=false;pointers.add(event.pointerId);cancelSettle();setSelecting(true);
      } else if (tool(event.target)) preserve.current=true;
      else dismiss();
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || tool(event.target)) return;
      move(event);
      if (!element.contains(event.target) || !moved && pendingTap && JSON.stringify(pendingTap.ranges) === JSON.stringify(current.current.ranges)) dismiss();
      pendingTap=null;
    };
    const release = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      move(event);changed();cancelSettle();
      if (!pointers.size) {if (event.type === 'pointercancel') settle();else setSelecting(false);}
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
      if (element.contains(event.target as Node) || element.contains(owner.getSelection()?.anchorNode ?? null)) {
        preserve.current=false;
        if (event.shiftKey || (event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='a') {keyboardSelecting=true;cancelSettle();setSelecting(true);}
      }
    };
    const keyUp = () => {if (keyboardSelecting) {keyboardSelecting=false;changed();cancelSettle();setSelecting(false);}};
    owner.addEventListener('selectionchange',changed);owner.addEventListener('pointerdown',start,true);owner.addEventListener('pointermove',move);
    owner.addEventListener('pointerup',release);owner.addEventListener('pointercancel',release);owner.addEventListener('click',click);
    owner.addEventListener('keydown',key);owner.addEventListener('keyup',keyUp);owner.defaultView?.addEventListener('blur',blur);
    return () => {
      cancelSettle();owner.removeEventListener('selectionchange',changed);owner.removeEventListener('pointerdown',start,true);owner.removeEventListener('pointermove',move);
      owner.removeEventListener('pointerup',release);owner.removeEventListener('pointercancel',release);owner.removeEventListener('click',click);
      owner.removeEventListener('keydown',key);owner.removeEventListener('keyup',keyUp);owner.defaultView?.removeEventListener('blur',blur);
    };
  }, [root,sentences,locked,mode,clear,setSelection]);
  return {selection,selecting,setSelection,clear,clearIf};
}
