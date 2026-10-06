import {useEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';
import type {BulletinReaderHighlightColor} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderMessages} from './ReaderToolbar';
import {renderedTextRanges, type ReaderTextRange} from '@/features/weekly-reader/text-range';

type Props = {
  messages: ReaderMessages; count: number; color: BulletinReaderHighlightColor | null;
  busy?: boolean; noteOpen?: boolean; noteButtonRef?: RefObject<HTMLButtonElement | null>;
  clearable?: boolean; root?: RefObject<HTMLDivElement | null>; ranges?: readonly ReaderTextRange[];
  onColor: (color: BulletinReaderHighlightColor) => void; onClear: () => void; onCopy: () => void; onNote: () => void;
};
export function SelectionToolbar({messages: m, count, color, busy, noteOpen, noteButtonRef, clearable = true, root, ranges, onColor, onClear, onCopy, onNote}: Props) {
  const tools = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>();
  useEffect(() => {
    const element = root?.current;
    if (!element || !ranges?.length || noteOpen) return;
    const measure = () => {
      const rects = ranges.flatMap(anchor => renderedTextRanges(element, anchor).flatMap(range => Array.from(range.getClientRects?.() ?? [])));
      const rect = rects.find(rect => rect.bottom > 0 && rect.top < window.innerHeight);
      if (!rect || !tools.current) {setPosition(undefined); return;}
      const visual = window.visualViewport;
      const top = visual?.offsetTop ?? 0, left = visual?.offsetLeft ?? 0;
      const width = visual?.width ?? window.innerWidth, height = visual?.height ?? window.innerHeight;
      const box = tools.current.getBoundingClientRect();
      const x = Math.max(left + 8, Math.min(rect.left + rect.width / 2 - box.width / 2, left + width - box.width - 8));
      const y = Math.max(top + 8, Math.min(rect.top - box.height - 8 >= top + 8 ? rect.top - box.height - 8 : rect.bottom + 8, top + height - box.height - 8));
      setPosition({'--reader-selection-x': `${x}px`, '--reader-selection-y': `${y}px`} as CSSProperties);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {cancelAnimationFrame(frame); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); window.visualViewport?.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('scroll', measure);};
  }, [root, ranges, count, noteOpen]);
  if (!count || noteOpen) return null;
  return <div ref={tools} className="reader-selection-tools" style={position} data-floating={!!position || undefined}>
    <p role="status" className="reader-selection-count">{m.selectionCount.replace('{count}', String(count))}</p>
    <div className="reader-selection-actions" role="group" aria-label={m.selectionActions}>
      <div className="reader-color-group" role="group" aria-label={m.highlightColors}>
        {(['yellow', 'red', 'blue'] as const).map(value => <button key={value} type="button" className="reader-color" disabled={busy} aria-label={m[`${value}Highlight`]} title={m[`${value}Highlight`]} aria-pressed={color === value} onClick={() => onColor(value)}><span aria-hidden="true" data-color={value}/></button>)}
      </div>
      <button type="button" disabled={busy || !clearable} onClick={onClear}>{m.clearHighlight}</button>
      <button type="button" onClick={onCopy}>{m.copySelection}</button>
      <button ref={noteButtonRef} type="button" disabled={busy} onClick={onNote}>{m.addNote}</button>
    </div>
  </div>;
}
