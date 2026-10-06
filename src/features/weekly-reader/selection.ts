import {bulletinBlocks, bulletinFixedText} from '@hallelujahhomechurch/ui';
import type {BulletinReaderHighlightColor, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';

export type ReaderSentence = {id: string; componentId: string; text: string};
export function readerSentences(document: MemberOnlineDocument): ReaderSentence[] {
  const fixed = new Set(document.content.layoutManifest.pages.flatMap(page => page.fixedSlots?.map(slot => slot.element) ?? []));
  return [
    ...(['title', 'subtitle', 'issueNumber', 'date'] as const).filter(element => fixed.has(element)).map(element => ({
      id: `canonical-${element}`, componentId: 'canonical', text: bulletinFixedText(element, document.canonicalMetadata, 0).text
    })),
    ...bulletinBlocks(document.content).flatMap(({componentId, block}) => block.sentences.map(sentence => ({id: sentence.id, componentId, text: sentence.spans.map(span => span.text).join('')})))
  ];
}

export function toggleSentence(selected: readonly string[], id: string, index: readonly ReaderSentence[]): string[] {
  const wanted = new Set(selected);
  if (wanted.has(id)) wanted.delete(id);
  else if (wanted.size < 500) wanted.add(id);
  return index.filter(sentence => wanted.has(sentence.id)).map(sentence => sentence.id);
}

export function selectedColor(selected: readonly string[], highlights: Readonly<Record<string, BulletinReaderHighlightColor | undefined>>): BulletinReaderHighlightColor | null {
  const first = highlights[selected[0]];
  return first && selected.every(id => highlights[id] === first) ? first : null;
}
