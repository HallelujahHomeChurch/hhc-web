import {useEffect, useState, type RefObject} from 'react';
import type {BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {renderedTextRanges, type ReaderTextRange} from '@/features/weekly-reader/text-range';

type Props = {root: RefObject<HTMLDivElement | null>; highlights: BulletinReaderState['highlights']; layoutKey: string; onSelect: (range: ReaderTextRange) => void};
export function RangeHighlights({root, highlights, layoutKey, onSelect}: Props) {
  const [boxes, setBoxes] = useState<{left: number; top: number; width: number; height: number; color: string}[]>([]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let targets: {rect: DOMRect; range: ReaderTextRange}[] = [];
    const measure = () => {
      const origin = element.getBoundingClientRect();
      const next: typeof boxes = [];
      targets = [];
      for (const highlight of highlights) {
        if (!highlight.active) continue;
        for (const part of highlight.segments ?? [{start: 0, end: [...highlight.quote].length, color: highlight.color}]) {
          const anchor = {sentenceId: highlight.sentenceId, start: part.start, end: part.end};
          const seen = new Set<string>();
          for (const range of renderedTextRanges(element, anchor)) for (const rect of Array.from(range.getClientRects?.() ?? [])) {
            if (!rect.width || !rect.height) continue;
            const key = `${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
            if (seen.has(key)) continue;
            seen.add(key);
            targets.push({rect, range: anchor});
            // Legacy full-sentence highlighting is already painted by the renderer.
            if (highlight.segments) next.push({left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height, color: part.color});
          }
        }
      }
      setBoxes(next);
    };
    const click = (event: MouseEvent) => {
      if (element.ownerDocument.getSelection()?.toString() || (event.target instanceof Element && event.target.closest('button'))) return;
      // Client rectangles change on scroll even when relative painted boxes don't.
      measure();
      const hit = targets.find(({rect}) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
      if (hit) onSelect(hit.range);
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    element.addEventListener('click', click);
    return () => {cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', measure); element.removeEventListener('click', click);};
  }, [root, highlights, layoutKey, onSelect]);
  return <div className="reader-range-layer" aria-hidden="true">{boxes.map((box, index) => <span key={index} data-reader-highlight={box.color} style={{left: box.left, top: box.top, width: box.width, height: box.height}}/>)}</div>;
}
