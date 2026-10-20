import {textClauses} from '@/features/weekly-reader/text-clauses';
import type {RefObject} from 'react';
import type {ReaderSentence} from '@/features/weekly-reader/selection';
import type {ReaderSelection} from '@/features/weekly-reader/useReaderSelection';

export function PassageText({root, sentences, selection, mobile, tabIndex}: {
  root: RefObject<HTMLDivElement | null>; sentences: readonly ReaderSentence[]; selection: ReaderSelection; mobile: boolean; tabIndex?: 0;
}) {
  return <div ref={root} tabIndex={tabIndex} data-sentence-selection={mobile || undefined} className="reader-recovery-anchors reader-recovery-text">{sentences.map(sentence => <p key={sentence.id}>{(mobile ? textClauses(sentence) : [{sentenceId:sentence.id,start:0,end:[...sentence.text].length}]).map(range => {
    const selected = selection.ranges ? selection.ranges.some(chosen => chosen.sentenceId===sentence.id&&chosen.start<=range.start&&chosen.end>=range.end) : selection.ids.includes(sentence.id);
    return <span key={range.start} role={mobile?'button':undefined} tabIndex={mobile?0:undefined} aria-pressed={mobile?selected:undefined} data-selected={mobile&&selected||undefined} data-sentence-id={sentence.id} data-fragment-start={range.start} data-fragment-end={range.end}>{[...sentence.text].slice(range.start,range.end).join('')}</span>;
  })}</p>)}</div>;
}
