import type {BulletinReaderMutation, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from './selection';
import type {ReadingAnchor} from './navigation';
export type BookmarkMutation = Extract<BulletinReaderMutation, {kind: 'createBookmark' | 'renameBookmark' | 'deleteBookmark' | 'reanchorBookmark'}>;
export function isBookmarkMutation(mutation: BulletinReaderMutation): mutation is BookmarkMutation {
  return mutation.kind === 'createBookmark' || mutation.kind === 'renameBookmark' || mutation.kind === 'deleteBookmark' || mutation.kind === 'reanchorBookmark';
}
export type BookmarkTarget = {sentenceId: string; offset: number; pageId: string};
export function exactBookmarkTarget(document: MemberOnlineDocument, anchor: ReadingAnchor): BookmarkTarget | null {
  if (anchor.kind !== 'sentence' || !Number.isSafeInteger(anchor.page)) return null;
  const pageId = document.content.pages[anchor.page]?.id, offset = anchor.start ?? 0;
  const sentence = readerSentences(document).find(sentence => sentence.id === anchor.id);
  if (!pageId || !sentence || !Number.isSafeInteger(offset) || offset < 0 || offset >= [...sentence.text].length) return null;
  const page = document.content.layoutManifest.pages.find(page => page.pageId === pageId);
  return page && (page.slots.some(slot => slot.fragments.some(fragment => fragment.sentenceId === anchor.id && fragment.start <= offset && offset < fragment.end)) || page.fixedSlots?.some(slot => `canonical-${slot.element}` === anchor.id)) ? {sentenceId: anchor.id, offset, pageId} : null;
}
export function bookmarkTargets(document: MemberOnlineDocument) {
  const sentences = readerSentences(document);
  return document.content.layoutManifest.pages.flatMap(page => [
    ...page.slots.flatMap(slot => slot.fragments.map(fragment => ({sentenceId: fragment.sentenceId, offset: fragment.start, pageId: page.pageId}))),
    ...(page.fixedSlots ?? []).map(slot => ({sentenceId: `canonical-${slot.element}`, offset: 0, pageId: page.pageId}))
  ]).filter(target => sentences.some(sentence => sentence.id === target.sentenceId && target.offset < [...sentence.text].length));
}
