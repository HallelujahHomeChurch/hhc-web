import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import type {PrivateReplica, PendingReaderMutation} from './offline-store';
import {readerSentences} from './selection';
import {rangeQuote} from './text-range';

/** Retain authored payloads and original quotations before deleting an old publication. */
export function retainUnresolvedIntents(replica: PrivateReplica | undefined, document: MemberOnlineDocument | undefined, defer: boolean): PendingReaderMutation[] {
  const retained = [...replica?.retained ?? []];
  for (const entry of replica?.queue ?? []) {
    const result = entry.resolution ? entry.resolution.result : entry.replayResult ?? entry.result;
    if (entry.resolution?.mutation === null || result?.status === 'applied') continue;
    if (!defer || (entry.sent || entry.replay) && !result || entry.resolution?.mutation && !entry.resolution.result) throw new Error('upgrade_incomplete');
    const mutation = entry.mutation;
    let sourceQuote = entry.sourceQuote;
    if (sourceQuote === undefined) {
      if ((mutation.kind === 'createNote' || mutation.kind === 'setHighlight' || mutation.kind === 'clearHighlight') && document?.revision === mutation.documentRevision) {
        const sentences = readerSentences(document);
        const ids = mutation.payload.sentenceIds;
        if (ids.some(id => !sentences.some(sentence => sentence.id === id))) throw new Error('original_context_unavailable');
        sourceQuote = mutation.payload.ranges ? rangeQuote(mutation.payload.ranges, sentences) : sentences.filter(sentence => ids.includes(sentence.id)).map(sentence => sentence.text).join('\n');
      } else if (mutation.kind === 'editNote' || mutation.kind === 'deleteNote' || mutation.kind === 'reanchorNote') { const id = mutation.payload.noteId; sourceQuote = replica?.state.notes.find(note => note.id === id)?.quote; }
      else if (mutation.kind === 'restoreHighlight' || mutation.kind === 'discardHighlightHistory') { const id = mutation.payload.historyId; sourceQuote = replica?.state.highlightHistory?.find(item => item.id === id)?.highlight?.quote; }
      if (sourceQuote === undefined && (mutation.kind === 'createNote' || mutation.kind === 'setHighlight' || mutation.kind === 'clearHighlight')) throw new Error('original_context_unavailable');
    }
    if (!retained.some(item => item.mutation.mutationId === mutation.mutationId)) retained.push({...structuredClone(entry), sourceQuote: sourceQuote ?? ''});
  }
  return retained;
}
