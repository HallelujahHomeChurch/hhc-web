import {useId, useRef} from 'react';
import {X} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {BulletinReaderHighlightColor, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderSentence} from '@/features/weekly-reader/selection';
import type {ReaderTextRange} from '@/features/weekly-reader/text-range';
import type {ReaderMessages} from './ReaderToolbar';

export function HighlightsPanel({highlights, sentences, messages: m, busy, onChange, query = ''}: {
  query?: string;
  highlights: BulletinReaderState['highlights']; sentences: readonly ReaderSentence[]; messages: ReaderMessages; busy: boolean;
  onChange: (range: ReaderTextRange, color: BulletinReaderHighlightColor | null) => Promise<void>;
}) {
  const heading = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const text = new Map(sentences.map(sentence => [sentence.id, [...sentence.text]]));
  const entries = highlights.filter(highlight => highlight.active && text.has(highlight.sentenceId)).flatMap(highlight => {
    const characters = text.get(highlight.sentenceId)!;
    return (highlight.segments ?? [{start: 0, end: characters.length, color: highlight.color}]).map(part => ({
      range: {sentenceId: highlight.sentenceId, start: part.start, end: part.end},
      color: part.color, quote: characters.slice(part.start, part.end).join('')
    }));
  }).filter(entry => entry.quote.normalize('NFKC').toLowerCase().includes(query.normalize('NFKC').trim().toLowerCase()));
  return <section aria-labelledby={heading} className="reader-highlights-list">
    <p className="reader-filter-count" role="status">{m.highlightCount.replace('{count}', String(entries.length))}</p>
    <h3 className="hhc-sr-only" id={heading} ref={headingRef} tabIndex={-1}>{m.savedHighlights}</h3>
    {!entries.length ? <p>{query.trim() ? m.noResults : m.highlightsEmpty}</p> : entries.map(({range, color, quote}) => <article key={`${range.sentenceId}:${range.start}:${range.end}`} aria-label={quote}>
      <blockquote data-color={color}>{quote}</blockquote>
      <div className="reader-note-actions" role="group" aria-label={quote}>
        <ReaderIconButton variant="ghost" aria-label={m.clearHighlight} isDisabled={busy} onPress={() => {void onChange(range, null).then(() => headingRef.current?.focus());}} icon={<X size={18} aria-hidden="true"/>}/>
      </div>
    </article>)}
  </section>;
}
