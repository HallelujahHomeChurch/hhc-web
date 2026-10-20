import {bulletinBlocks, type BulletinCanonicalMetadata} from '@hallelujahhomechurch/ui';
import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';

/** Map a normalized search match back to canonical Unicode scalar offsets. */
export function searchMatch(text: string, query: string): {start: number; end: number} | null {
  let scalar = 0, normalizedLength = 0;
  const parts = Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text), ({segment}) => {
    const start = scalar;
    scalar += [...segment].length; normalizedLength += segment.normalize('NFKC').toLowerCase().length;
    return {start, end: scalar, to: normalizedLength};
  });
  const needle = query.normalize('NFKC').trim().toLowerCase(), at = text.normalize('NFKC').toLowerCase().indexOf(needle);
  if (!needle || at < 0) return null;
  return {start: parts.find(part => part.to > at)!.start, end: parts.find(part => part.to >= at + needle.length)!.end};
}

export function searchSentences(content: MemberOnlineDocument['content'], query: string, metadata?: BulletinCanonicalMetadata) {
  const needle = query.normalize('NFKC').trim().toLowerCase();
  if (!needle) return [];
  const sentences = [
    ...(metadata ? [{sentenceId: 'canonical-title', text: metadata.title}, {sentenceId: 'canonical-subtitle', text: metadata.subtitle}] : []),
    ...bulletinBlocks(content).flatMap(({block}) => block.sentences.map(sentence => ({sentenceId: sentence.id, text: sentence.spans.map(span => span.text).join('')})))
  ];
  return sentences.filter(sentence => sentence.text.normalize('NFKC').toLowerCase().includes(needle));
}
