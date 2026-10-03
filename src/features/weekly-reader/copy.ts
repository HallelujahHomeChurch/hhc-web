import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from './selection';
import {rangeQuote, type ReaderTextRange} from './text-range';

export async function copyTextRanges(document: MemberOnlineDocument, ranges: readonly ReaderTextRange[], allowAction: () => boolean, clipboard: Pick<Clipboard, 'writeText'> = navigator.clipboard) {
  const text = rangeQuote(ranges, readerSentences(document));
  if (!allowAction()) throw new Error('copy_unavailable');
  await clipboard.writeText(`${text}\n\n— 第 ${document.canonicalMetadata.issueNumber} 期《${document.canonicalMetadata.title}》`);
}

export async function copySentences(document: MemberOnlineDocument, selected: readonly string[], allowAction: () => boolean, clipboard: Pick<Clipboard, 'writeText'> = navigator.clipboard) {
  const wanted = new Set(selected);
  const sentences = readerSentences(document).filter(sentence => wanted.has(sentence.id));
  if (!sentences.length || sentences.length !== wanted.size || !allowAction()) throw new Error('copy_unavailable');
  const text = sentences.map((sentence, index) => `${index && sentence.componentId !== sentences[index - 1].componentId ? '\n\n' : ''}${sentence.text}`).join('');
  await clipboard.writeText(`${text}\n\n— 第 ${document.canonicalMetadata.issueNumber} 期《${document.canonicalMetadata.title}》`);
}
