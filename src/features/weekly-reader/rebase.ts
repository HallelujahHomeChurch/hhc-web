import type {BulletinReaderMutation, BulletinReaderState, BulletinReaderStateResponse, BulletinReaderHighlightColor, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from './selection';
import {rangeQuote, type ReaderTextRange} from './text-range';

export type ReaderRecovery = {mutationId: string; reason: 'removed_anchor' | 'anchor_limit' | 'color_conflict' | 'note_conflict' | 'mapping_unavailable' | 'expired_mutation'};
export function rebaseReaderMutations(pending: readonly BulletinReaderMutation[], previous: BulletinReaderState, current: BulletinReaderState, mappings: NonNullable<BulletinReaderStateResponse['mappings']>) {
  if (previous.accountId !== current.accountId || previous.documentId !== current.documentId || current.currentRevision < previous.currentRevision) throw new Error('invalid_reader_binding');
  const map = new Map(mappings.map(mapping => [mapping.fromSentenceId, mapping.toSentenceIds]));
  if (map.size !== mappings.length) throw new Error('invalid_reader_mapping');
  const recovery: ReaderRecovery[] = [];
  const mutations: BulletinReaderMutation[] = [];
  const lastColors = new Map<string, string>();
  for (const mutation of pending) {
    if (mutation.kind === 'setHighlight') for (const id of mutation.payload.sentenceIds) lastColors.set(id, mutation.payload.color);
    if (mutation.kind === 'clearHighlight') for (const id of mutation.payload.sentenceIds) lastColors.delete(id);
  }
  const targetColors = new Map<string, Set<string>>();
  for (const [source, color] of lastColors) for (const target of map.get(source) ?? []) {
    const colors = targetColors.get(target) ?? new Set<string>(); colors.add(color); targetColors.set(target, colors);
  }
  for (const input of pending) {
    const mutation = structuredClone(input);
    if (mutation.documentRevision === current.currentRevision) {mutations.push(mutation); continue;}
    if ('ranges' in mutation.payload) {
      // Published sentence mappings do not prove partial text offsets.
      recovery.push({mutationId: mutation.mutationId, reason: 'mapping_unavailable'});
      continue;
    }
    let reason: ReaderRecovery['reason'] | undefined;
    if (mutation.documentRevision !== previous.currentRevision) reason = 'mapping_unavailable';
    if (mutation.kind === 'setHighlight' || mutation.kind === 'clearHighlight' || mutation.kind === 'createNote') {
      const targets = mutation.payload.sentenceIds.flatMap(id => map.get(id) ?? []);
      if (mutation.payload.sentenceIds.some(id => !map.has(id))) reason = 'mapping_unavailable';
      else if (mutation.payload.sentenceIds.some(id => !map.get(id)?.length)) reason = 'removed_anchor';
      else if (new Set(targets).size > 500) reason = 'anchor_limit';
      else if (mutation.kind === 'setHighlight' && targets.some(id => (targetColors.get(id)?.size ?? 0) > 1)) reason = 'color_conflict';
      mutation.payload.sentenceIds = [...new Set(targets)];
    }
    if (mutation.kind === 'editNote' || mutation.kind === 'deleteNote') {
      const before = previous.notes.find(note => note.id === mutation.payload.noteId);
      const after = current.notes.find(note => note.id === mutation.payload.noteId);
      // A version change cannot be proven migration-only from matching text.
      if (before && (!after || after.version !== before.version || after.deleted !== before.deleted || after.text !== before.text)) reason = 'note_conflict';
    }
    if (mutation.kind === 'setProgress') {
      const target = mutation.payload.sentenceId ? map.get(mutation.payload.sentenceId)?.[0] : undefined;
      mutation.payload = target ? {sentenceId: target} : {};
    }
    if (mutation.kind === 'resolveHighlightMigrationConflict') reason = 'color_conflict';
    if (mutation.kind === 'discardHighlightHistory' && !current.highlightHistory?.some(entry => entry.id === mutation.payload.historyId && entry.highlight)) reason = 'removed_anchor';
    if (reason) recovery.push({mutationId: mutation.mutationId, reason});
    else {mutation.documentRevision = current.currentRevision; mutations.push(mutation);}
  }
  return {mutations, recovery};
}

export function manualReaderRecovery(original: BulletinReaderMutation, state: BulletinReaderState, document: MemberOnlineDocument, choice: {sentenceIds: string[]; text: string; color: BulletinReaderHighlightColor; ranges?: ReaderTextRange[]}): BulletinReaderMutation {
  if (state.documentId !== document.documentId || state.currentRevision !== document.revision) throw new Error('invalid_reader_binding');
  const partial = 'ranges' in original.payload;
  if (partial && !choice.ranges?.length) throw new Error('range_reselection_required');
  if (choice.ranges) {
    rangeQuote(choice.ranges, readerSentences(document));
    if (JSON.stringify(choice.ranges.map(range => range.sentenceId)) !== JSON.stringify(choice.sentenceIds)) throw new Error('invalid_reader_anchor');
  }
  const ranges = choice.ranges ? {ranges: choice.ranges} : {};
  const common = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: document.revision};
  const anchors = () => {
    const ids = [...new Set(choice.sentenceIds)], valid = new Set(readerSentences(document).map(sentence => sentence.id));
    if (!ids.length || ids.length > 500 || ids.some(id => !valid.has(id))) throw new Error('invalid_reader_anchor');
    return ids;
  };
  if (original.kind === 'setHighlight') return {...common, kind: original.kind, payload: {sentenceIds: anchors(), color: choice.color, ...ranges}};
  if (original.kind === 'clearHighlight') return {...common, kind: original.kind, payload: {sentenceIds: anchors(), ...ranges}};
  if (original.kind === 'setProgress') return {...common, kind: original.kind, payload: choice.sentenceIds.length ? {sentenceId: anchors()[0]} : {}};
  if (original.kind === 'resolveHighlightMigrationConflict') throw new Error('invalid_reader_conflict');
  if (original.kind === 'restoreHighlight' || original.kind === 'discardHighlightHistory') {
    if (!state.highlightHistory?.some(entry => entry.id === original.payload.historyId && entry.highlight)) throw new Error('conflict_not_found');
    if (original.kind === 'discardHighlightHistory') return {...common, kind: original.kind, payload: {historyId: original.payload.historyId}};
    if (!choice.ranges?.length) throw new Error('range_reselection_required');
    return {...common, kind: original.kind, payload: {historyId: original.payload.historyId, sentenceIds: anchors(), ranges: choice.ranges, color: choice.color}};
  }
  const cloud = state.notes.find(note => note.id === original.payload.noteId && !note.deleted);
  if (original.kind === 'reanchorNote') {
    if (!cloud) throw new Error('note_already_deleted');
    if (!cloud.reanchorRequired && !cloud.inactiveAnchors.length) throw new Error('note_already_reanchored');
    if (!choice.ranges?.length) throw new Error('range_reselection_required');
    return {...common, kind: 'reanchorNote', baseVersion: cloud.version, payload: {noteId: cloud.id, sentenceIds: anchors(), ranges: choice.ranges}};
  }
  if (original.kind === 'deleteNote') {
    if (!cloud) throw new Error('note_already_deleted');
    return {...common, kind: 'deleteNote', baseVersion: cloud.version, payload: {noteId: cloud.id}};
  }
  if (!choice.text.trim() || [...choice.text].length > 10000) throw new Error('invalid_note_text');
  if (cloud) return {...common, kind: 'editNote', baseVersion: cloud.version, payload: {noteId: cloud.id, text: choice.text}};
  return {...common, kind: 'createNote', payload: {noteId: original.kind === 'createNote' && !state.notes.some(note => note.id === original.payload.noteId) ? original.payload.noteId : crypto.randomUUID(), sentenceIds: anchors(), text: choice.text, ...ranges}};
}
