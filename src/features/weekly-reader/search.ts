import {bulletinBlocks, type BulletinCanonicalMetadata} from '@hallelujahhomechurch/ui';
import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';

export function searchSentences(content: MemberOnlineDocument['content'], query: string, metadata?: BulletinCanonicalMetadata) {
  const needle = query.normalize('NFKC').trim().toLowerCase();
  if (!needle) return [];
  const sentences = [
    ...(metadata ? [{sentenceId: 'canonical-title', text: metadata.title}, {sentenceId: 'canonical-subtitle', text: metadata.subtitle}] : []),
    ...bulletinBlocks(content).flatMap(({block}) => block.sentences.map(sentence => ({sentenceId: sentence.id, text: sentence.spans.map(span => span.text).join('')})))
  ];
  return sentences.filter(sentence => sentence.text.normalize('NFKC').toLowerCase().includes(needle));
}
