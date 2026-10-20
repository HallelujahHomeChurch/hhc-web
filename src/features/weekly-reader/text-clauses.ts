import type {ReaderSentence} from './selection';
import {rangeQuote, type ReaderTextRange} from './text-range';

/** Chinese clause boundaries keep canonical IDs and Unicode scalar offsets intact. */
export function textClauses(sentence: ReaderSentence): ReaderTextRange[] {
  const points = [...sentence.text], ranges: ReaderTextRange[] = [];
  let start = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i] !== '，' && points[i] !== '。') continue;
    while (i + 1 < points.length && /[」』”’"）)\]】》〉]/u.test(points[i + 1])) i++;
    const end = i + 1;
    ranges.push({sentenceId: sentence.id, start, end}); start = end;
  }
  if (points.slice(start).join('').trim()) ranges.push({sentenceId: sentence.id, start, end: points.length});
  else if (ranges.length) ranges[ranges.length - 1].end = points.length;
  return ranges;
}

/** Never infer a hit from an ID when the mounted fragment doesn't match canonical text. */
export function fragmentClauses(element: HTMLElement, sentences: readonly ReaderSentence[], clauses: readonly ReaderTextRange[]): ReaderTextRange[] {
  const sentence = sentences.find(sentence => sentence.id === element.dataset.sentenceId);
  const start = Number(element.dataset.fragmentStart), end = Number(element.dataset.fragmentEnd);
  if (!sentence || element.closest('[hidden], [inert], [aria-hidden="true"]') || element.dataset.fragmentStart === undefined || element.dataset.fragmentEnd === undefined ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end || end > [...sentence.text].length || element.textContent !== [...sentence.text].slice(start, end).join('')) return [];
  return clauses.filter(clause => clause.sentenceId === sentence.id && clause.start < end && clause.end > start);
}

/** Adjacent taps extend one passage; an existing unit clears it, a distant unit resets it. */
export function toggleClauseRanges(selected: readonly ReaderTextRange[], target: ReaderTextRange, clauses: readonly ReaderTextRange[], sentences: readonly ReaderSentence[]): ReaderTextRange[] {
  const hit = clauses.findIndex(clause => clause.sentenceId === target.sentenceId && clause.start === target.start && clause.end === target.end);
  if (hit < 0) return [...selected];
  if (!selected.length) return [target];
  try {rangeQuote(selected, sentences);} catch {return [target];}
  if (selected.some(range => range.sentenceId === target.sentenceId && range.start <= target.start && range.end >= target.end)) return [];
  const first = clauses.findIndex(clause => clause.sentenceId === selected[0].sentenceId && clause.start === selected[0].start);
  const last = clauses.findIndex(clause => clause.sentenceId === selected.at(-1)!.sentenceId && clause.end === selected.at(-1)!.end);
  if (first < 0 || last < first || hit !== first - 1 && hit !== last + 1) return [target];
  const from = clauses[Math.min(first, hit)], to = clauses[Math.max(last, hit)];
  const fromSentence = sentences.findIndex(sentence => sentence.id === from.sentenceId), toSentence = sentences.findIndex(sentence => sentence.id === to.sentenceId);
  const next = sentences.slice(fromSentence, toSentence + 1).map(sentence => ({sentenceId: sentence.id, start: sentence.id === from.sentenceId ? from.start : 0, end: sentence.id === to.sentenceId ? to.end : [...sentence.text].length}));
  try {rangeQuote(next, sentences); return next;} catch {return [...selected];}
}
