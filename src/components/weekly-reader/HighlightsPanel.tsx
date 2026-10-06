import {useId, useRef} from 'react';
import {Button} from '@hallelujahhomechurch/ui';
import type {BulletinReaderHighlightColor, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderSentence} from '@/features/weekly-reader/selection';
import type {ReaderTextRange} from '@/features/weekly-reader/text-range';
import type {ReaderMessages} from './ReaderToolbar';

export function HighlightsPanel({highlights, sentences, messages: m, busy, onChange}: {
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
  });
  return <section aria-labelledby={heading} className="reader-highlights-list">
    <h3 id={heading} ref={headingRef} tabIndex={-1}>{m.savedHighlights}</h3>
    {!entries.length ? <p>{m.highlightsEmpty}</p> : entries.map(({range, color, quote}) => <article key={`${range.sentenceId}:${range.start}:${range.end}`} aria-label={quote}>
      <blockquote>{quote}</blockquote>
      <div className="reader-note-actions" role="group" aria-label={quote}>
        {(['yellow', 'red', 'blue'] as const).map(value => <Button key={value} variant="ghost" className="reader-color" aria-label={m[`${value}Highlight`]} aria-pressed={color === value} isDisabled={busy} onPress={() => {void onChange(range, value).then(() => headingRef.current?.focus());}}><span aria-hidden="true" data-color={value}/></Button>)}
        <Button variant="secondary" isDisabled={busy} onPress={() => {void onChange(range, null).then(() => headingRef.current?.focus());}}>{m.clearHighlight}</Button>
      </div>
    </article>)}
  </section>;
}
