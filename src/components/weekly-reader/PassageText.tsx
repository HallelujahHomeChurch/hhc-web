import type {RefObject} from 'react';
import type {ReaderSentence} from '@/features/weekly-reader/selection';
import type {ReaderSelection} from '@/features/weekly-reader/useReaderSelection';

export function PassageText({root, sentences, selection, mobile, tabIndex}: {
  root: RefObject<HTMLDivElement | null>; sentences: readonly ReaderSentence[]; selection: ReaderSelection; mobile: boolean; tabIndex?: 0;
}) {
  return <div ref={root} tabIndex={tabIndex} data-sentence-selection={mobile || undefined} className="reader-recovery-anchors reader-recovery-text">{sentences.map(sentence => <p key={sentence.id}><span role={mobile?'button':undefined} tabIndex={mobile?0:undefined} aria-pressed={mobile?selection.ids.includes(sentence.id):undefined} data-selected={mobile&&selection.ids.includes(sentence.id)||undefined} data-sentence-id={sentence.id} data-fragment-start="0" data-fragment-end={[...sentence.text].length}>{sentence.text}</span></p>)}</div>;
}
