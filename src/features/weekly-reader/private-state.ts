import type {BulletinReaderMutation, BulletinReaderState, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from './selection';
import {rangeQuote} from './text-range';

export function verifyPrivateState(state: BulletinReaderState, accountId: string, documentId: string, revision: number): BulletinReaderState {
  if (!state || state.accountId !== accountId || state.documentId !== documentId ||
      !Number.isSafeInteger(state.currentRevision) || state.currentRevision < revision || state.appliedRevision !== state.currentRevision ||
      !Array.isArray(state.highlights) || !Array.isArray(state.notes) || !Array.isArray(state.conflicts)) throw new Error('invalid_reader_binding');
  return state;
}

/** Keep the confirmed snapshot untouched so a rejected request can roll back. */
export function optimisticReaderState(state: BulletinReaderState, mutation: BulletinReaderMutation, document: MemberOnlineDocument): BulletinReaderState {
  verifyPrivateState(state, state.accountId, document.documentId, document.revision);
  if (mutation.documentRevision !== state.currentRevision || document.revision !== state.currentRevision) throw new Error('revision_changed');
  const sentences = readerSentences(document);
  if (mutation.kind === 'setHighlight' || mutation.kind === 'clearHighlight') {
    const ids = mutation.payload.sentenceIds;
    const selected = new Set(ids);
    if (!ids.length || ids.length > 500 || selected.size !== ids.length || ids.some(id => !sentences.some(sentence => sentence.id === id))) throw new Error('invalid_anchors');
    if (state.conflicts.some(conflict => conflict.sentenceIds.some(id => selected.has(id)))) throw new Error('migration_conflict');
    const ranges = mutation.payload.ranges;
    if (ranges !== undefined) {
      rangeQuote(ranges, sentences);
      if (ranges.length !== ids.length || ranges.some(range => !selected.has(range.sentenceId))) throw new Error('invalid_anchors');
    }
    const highlights = state.highlights.filter(highlight => !selected.has(highlight.sentenceId));
    for (const sentence of sentences) {
      if (!selected.has(sentence.id)) continue;
      const previous = state.highlights.find(highlight => highlight.sentenceId === sentence.id);
      if (ranges) {
        const range = ranges.find(range => range.sentenceId === sentence.id)!;
        const segments = (previous?.active ? previous.segments ?? [{start: 0, end: [...sentence.text].length, color: previous.color}] : []).flatMap(part => {
          if (part.end <= range.start || part.start >= range.end) return [{...part}];
          return [...(part.start < range.start ? [{...part, end: range.start}] : []), ...(part.end > range.end ? [{...part, start: range.end}] : [])];
        });
        if (mutation.kind === 'setHighlight') segments.push({start: range.start, end: range.end, color: mutation.payload.color});
        segments.sort((a, b) => a.start - b.start);
        const merged: typeof segments = [];
        for (const part of segments) {
          const last = merged.at(-1);
          if (last?.end === part.start && last.color === part.color) last.end = part.end;
          else merged.push(part);
        }
        if (merged.length > 256) throw new Error('segment_limit');
        if (merged.length) highlights.push({sentenceId: sentence.id, color: merged[0].color, segments: merged, quote: sentence.text, active: true, version: (previous?.version ?? 0) + 1, updatedAt: mutation.createdAt});
        continue;
      }
      if (mutation.kind === 'clearHighlight') continue;
      highlights.push({sentenceId: sentence.id, color: mutation.payload.color, quote: sentence.text, active: true, version: (previous?.version ?? 0) + 1, updatedAt: mutation.createdAt});
    }
    return {...state, highlights};
  }
  if (mutation.kind === 'setProgress') {
    const {pageId = '', componentId = '', sentenceId = ''} = mutation.payload;
    if (pageId && !document.content.pages.some(page => page.id === pageId) || componentId && !sentences.some(sentence => sentence.componentId === componentId) || sentenceId && !sentences.some(sentence => sentence.id === sentenceId)) throw new Error('invalid_anchors');
    if (state.progress && Date.parse(state.progress.recordedAt) > Date.parse(mutation.createdAt)) return state;
    return {...state, progress: pageId || componentId || sentenceId ? {pageId, componentId, sentenceId, recordedAt: mutation.createdAt, updatedAt: mutation.createdAt} : null};
  }
  // Notes finish only on server acknowledgement or a durable offline enqueue.
  return state;
}

/** Call inside the offline transaction, not as an acknowledgement of network I/O. */
export function applyLocalMutation(state: BulletinReaderState, mutation: BulletinReaderMutation, document: MemberOnlineDocument): BulletinReaderState {
  const projected = optimisticReaderState(state, mutation, document);
  if (mutation.kind === 'createNote') {
    const {noteId, sentenceIds, text, ranges} = mutation.payload;
    const ids = new Set(sentenceIds);
    const sentences = readerSentences(document).filter(sentence => ids.has(sentence.id));
    if (!text.trim() || [...text].length > 10000 || !ids.size || ids.size > 500 || sentences.length !== ids.size || ids.size !== sentenceIds.length) throw new Error('invalid_note');
    if (state.notes.some(note => note.id === noteId)) throw new Error('note_conflict');
    if (ranges !== undefined && (ranges.length !== ids.size || ranges.some(range => !ids.has(range.sentenceId)))) throw new Error('invalid_anchors');
    const quote = ranges === undefined ? sentences.map((sentence, index) => `${index && sentence.componentId !== sentences[index - 1].componentId ? '\n\n' : ''}${sentence.text}`).join('') : rangeQuote(ranges, readerSentences(document));
    return {...state, notes: [...state.notes, {id: noteId, text, sentenceIds: sentences.map(sentence => sentence.id), ...(ranges ? {ranges: ranges.map(range => ({...range, quote: sentences.find(sentence => sentence.id === range.sentenceId)!.text}))} : {}), inactiveAnchors: [], quote, version: 1, deleted: false, reanchorRequired: false, createdAt: mutation.createdAt, updatedAt: mutation.createdAt}]};
  }
  if (mutation.kind === 'editNote' || mutation.kind === 'deleteNote') {
    const note = state.notes.find(note => note.id === mutation.payload.noteId);
    if (!note || note.deleted || note.version !== mutation.baseVersion) throw new Error('note_conflict');
    if (mutation.kind === 'editNote' && (!mutation.payload.text.trim() || [...mutation.payload.text].length > 10000)) throw new Error('invalid_note');
    return {...state, notes: state.notes.map(current => current !== note ? current : {
      ...note, version: note.version + 1, updatedAt: mutation.createdAt,
      ...(mutation.kind === 'editNote' ? {text: mutation.payload.text} : {deleted: true, text: '', quote: '', sentenceIds: [], ranges: undefined, inactiveAnchors: [], reanchorRequired: false})
    })};
  }
  return projected;
}
