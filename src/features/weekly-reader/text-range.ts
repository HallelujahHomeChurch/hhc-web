import type {ReaderSentence} from './selection';

export type ReaderTextRange = {sentenceId: string; start: number; end: number};

/** Recover DOM ranges for the mounted fragments without mutating React's text. */
export function renderedTextRanges(root: HTMLElement, selected: ReaderTextRange): Range[] {
  const ranges: Range[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('[data-sentence-id]')) {
    if (element.dataset.sentenceId !== selected.sentenceId || element.closest('[inert], [hidden], [aria-hidden="true"]')) continue;
    const from = Number(element.dataset.fragmentStart), to = Number(element.dataset.fragmentEnd);
    const start = Math.max(from, selected.start) - from, end = Math.min(to, selected.end) - from;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= end) continue;
    const walker = root.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = root.ownerDocument.createRange();
    let offset = 0, started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const points = Array.from(node.textContent ?? '');
      if (!started && start <= offset + points.length) {
        range.setStart(node, points.slice(0, start - offset).join('').length); started = true;
      }
      if (started && end <= offset + points.length) {
        range.setEnd(node, points.slice(0, end - offset).join('').length); ranges.push(range); break;
      }
      offset += points.length;
    }
  }
  return ranges;
}

/** Native ranges use UTF-16; persisted anchors use Unicode scalar offsets. */
export function readTextSelection(root: HTMLElement, selection: Selection | null, sentences: readonly ReaderSentence[]): ReaderTextRange[] {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return [];
  const selected = selection.getRangeAt(0);
  if (!root.contains(selected.startContainer) || !root.contains(selected.endContainer)) return [];
  const index = new Map(sentences.map(sentence => [sentence.id, sentence]));
  const ranges: ReaderTextRange[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('[data-sentence-id]')) {
    if (!selected.intersectsNode(element)) continue;
    const overlap = root.ownerDocument.createRange();
    overlap.selectNodeContents(element);
    if (selected.compareBoundaryPoints(Range.START_TO_START, overlap) > 0) overlap.setStart(selected.startContainer, selected.startOffset);
    if (selected.compareBoundaryPoints(Range.END_TO_END, overlap) < 0) overlap.setEnd(selected.endContainer, selected.endOffset);
    if (overlap.collapsed || !overlap.toString()) continue;
    if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return [];
    const sentence = index.get(element.dataset.sentenceId ?? '');
    const start = Number(element.dataset.fragmentStart), end = Number(element.dataset.fragmentEnd);
    if (!sentence || element.dataset.fragmentStart === undefined || element.dataset.fragmentEnd === undefined ||
        !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end) return [];
    const points = Array.from(sentence.text);
    if (end > points.length || element.textContent !== points.slice(start, end).join('')) return [];
    const prefix = root.ownerDocument.createRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(overlap.startContainer, overlap.startOffset);
    const before = prefix.toString();
    prefix.setEnd(overlap.endContainer, overlap.endOffset);
    const through = prefix.toString();
    // A programmatic/corrupt boundary must not slice an emoji in half.
    if (!before.isWellFormed() || !through.isWellFormed()) return [];
    const range = {sentenceId: sentence.id, start: start + Array.from(before).length, end: start + Array.from(through).length};
    const previous = ranges.at(-1);
    if (previous?.sentenceId === range.sentenceId) {
      if (previous.end !== range.start) return [];
      previous.end = range.end;
    } else ranges.push(range);
    if (ranges.length > 500) return [];
  }
  try {
    const quote = rangeQuote(ranges, sentences);
    // Fixed labels/headings are not anchors. Never silently truncate a mixed
    // selection; only structural whitespace may differ from the trusted quote.
    return quote.replace(/\s/gu, '') === selected.toString().replace(/\s/gu, '') ? ranges : [];
  } catch {return [];}
}

/** Validate order/continuity before constructing a private quote from trusted text. */
export function rangeQuote(ranges: readonly ReaderTextRange[], sentences: readonly ReaderSentence[]): string {
  if (!ranges.length || ranges.length > 500) throw new Error('invalid_text_range');
  const index = new Map(sentences.map((sentence, position) => [sentence.id, {sentence, position, points: Array.from(sentence.text)}]));
  let previous: {position: number; end: number; length: number; componentId: string} | undefined;
  return ranges.map(range => {
    const entry = index.get(range.sentenceId);
    if (!entry || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.start >= range.end || range.end > entry.points.length ||
        previous && (entry.position !== previous.position + 1 || previous.end !== previous.length || range.start !== 0)) throw new Error('invalid_text_range');
    const separator = previous && previous.componentId !== entry.sentence.componentId ? '\n\n' : '';
    previous = {position: entry.position, end: range.end, length: entry.points.length, componentId: entry.sentence.componentId};
    return separator + entry.points.slice(range.start, range.end).join('');
  }).join('');
}
