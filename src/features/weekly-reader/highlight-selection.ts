import type {BulletinReaderState, BulletinReaderHighlightColor} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderTextRange} from './text-range';

export function selectedHighlight(ranges: readonly ReaderTextRange[], highlights: BulletinReaderState['highlights']): {color: BulletinReaderHighlightColor | null; clearable: boolean} {
  const colors = new Set<BulletinReaderHighlightColor>();
  let clearable = false, complete = ranges.length > 0;
  for (const range of ranges) {
    const highlight = highlights.find(value => value.active && value.sentenceId === range.sentenceId);
    const parts = highlight?.segments ?? (highlight ? [{start: 0, end: [...highlight.quote].length, color: highlight.color}] : []);
    let covered = 0;
    for (const part of parts) {
      const length = Math.min(range.end, part.end) - Math.max(range.start, part.start);
      if (length > 0) {covered += length; colors.add(part.color); clearable = true;}
    }
    if (covered !== range.end - range.start) complete = false;
  }
  return {color: complete && colors.size === 1 ? [...colors][0] : null, clearable};
}
