import {expect, it} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {rebaseReaderMutations, manualReaderRecovery} from './rebase';

it('requires explicit recovery for partial ranges when only sentence mappings are available', () => {
  const state = {accountId: 'a', documentId: 'd', currentRevision: 1, appliedRevision: 1, highlights: [], notes: [], conflicts: [], progress: null};
  const mutation = {mutationId: 'range', documentRevision: 1, createdAt: '2026-10-03T00:00:00Z', kind: 'setHighlight' as const, payload: {sentenceIds: ['a'], color: 'yellow' as const, ranges: [{sentenceId: 'a', start: 1, end: 2}]}};
  const result = rebaseReaderMutations([mutation], state, {...state, currentRevision: 2, appliedRevision: 2}, [{fromSentenceId: 'a', toSentenceIds: ['a']}]);
  expect(result.mutations).toEqual([]);
  expect(result.recovery).toEqual([{mutationId: 'range', reason: 'mapping_unavailable'}]);
  expect(mutation.documentRevision).toBe(1);
});
import {readerFixture} from './test-fixture';

const state: BulletinReaderState = {accountId: 'a', documentId: 'd', appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const base = {createdAt: '2026-10-02T00:00:00Z', documentRevision: 1};
it('never recreates consumed history and requires fresh partial ranges to restore it', () => {
  const document = readerFixture().document;
  const highlight = {sentenceId: 'old', quote: 'Old source', color: 'red' as const, active: false, version: 1, updatedAt: ''};
  const cloud = {...state, documentId: document.documentId, highlightHistory: [{id: 'history', highlight}]};
  const original: BulletinReaderMutation = {...base, mutationId: 'restore', kind: 'restoreHighlight', payload: {historyId: 'history', sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 0, end: 1}], color: 'red'}};
  const choice = {sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 1, end: 3}], text: '', color: 'blue' as const};
  expect(manualReaderRecovery(original, cloud, document, choice)).toMatchObject({kind: 'restoreHighlight', payload: {historyId: 'history', sentenceIds: ['s1'], ranges: choice.ranges, color: 'blue'}});
  expect(() => manualReaderRecovery(original, cloud, document, {...choice, ranges: undefined})).toThrow('range_reselection_required');
  const discard: BulletinReaderMutation = {...base, mutationId: 'discard', kind: 'discardHighlightHistory', payload: {historyId: 'history'}};
  expect(manualReaderRecovery(discard, cloud, document, choice)).toMatchObject({kind: 'discardHighlightHistory', payload: {historyId: 'history'}});
  for (const action of [original, discard]) expect(() => manualReaderRecovery(action, {...cloud, highlightHistory: [{id: 'history'}]}, document, choice)).toThrow('conflict_not_found');
  expect(rebaseReaderMutations([original], cloud, {...cloud, currentRevision: 2, appliedRevision: 2}, []).recovery).toEqual([{mutationId: 'restore', reason: 'mapping_unavailable'}]);
  expect(rebaseReaderMutations([discard], cloud, {...cloud, currentRevision: 2, appliedRevision: 2, highlightHistory: [{id: 'history'}]}, []).recovery).toEqual([{mutationId: 'discard', reason: 'removed_anchor'}]);
});
it('requires fresh ranges and preserves reanchor intent on recovery without recreating a deleted note', () => {
  const document = readerFixture().document;
  const note = {id: 'note', text: 'Private', quote: 'Original', version: 3, deleted: false, sentenceIds: [], inactiveAnchors: [], reanchorRequired: true, createdAt: '', updatedAt: ''};
  const cloud = {...state, documentId: document.documentId, notes: [note]};
  const original: BulletinReaderMutation = {...base, mutationId: 'old', kind: 'reanchorNote', baseVersion: 1, payload: {noteId: 'note', sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 0, end: 1}]}};
  const choice = {sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 1, end: 3}], text: '', color: 'yellow' as const};
  expect(manualReaderRecovery(original, cloud, document, choice)).toMatchObject({kind: 'reanchorNote', baseVersion: 3, payload: {noteId: 'note', sentenceIds: ['s1'], ranges: choice.ranges}});
  expect(() => manualReaderRecovery(original, cloud, document, {...choice, ranges: undefined})).toThrow('range_reselection_required');
  expect(() => manualReaderRecovery(original, {...cloud, notes: []}, document, choice)).toThrow('note_already_deleted');
  expect(rebaseReaderMutations([original], cloud, {...cloud, appliedRevision: 2, currentRevision: 2}, []).recovery).toEqual([{mutationId: 'old', reason: 'mapping_unavailable'}]);
});
it('requires a freshly selected range for manual partial recovery instead of widening to full sentences', () => {
  const document = readerFixture().document;
  const cloud = {...state, documentId: document.documentId, currentRevision: document.revision};
  const original = {...base, mutationId: 'partial', kind: 'setHighlight' as const, payload: {sentenceIds: ['s0'], color: 'yellow' as const, ranges: [{sentenceId: 's0', start: 1, end: 2}]}};
  const choice = {sentenceIds: ['s0'], text: '', color: 'blue' as const};
  expect(() => manualReaderRecovery(original, cloud, document, choice)).toThrow('range_reselection_required');
  expect(manualReaderRecovery(original, cloud, document, {...choice, ranges: [{sentenceId: 's0', start: 0, end: 2}]})).toMatchObject({payload: {sentenceIds: ['s0'], color: 'blue', ranges: [{sentenceId: 's0', start: 0, end: 2}]}});
});
it('preserves mutation IDs and expands splits without silently dropping removed anchors or oversized atomic groups', () => {
  const mutation: BulletinReaderMutation = {...base, mutationId: 'id', kind: 'setHighlight', payload: {sentenceIds: ['a', 'b'], color: 'yellow'}};
  const cloud = {...state, appliedRevision: 2, currentRevision: 2};
  expect(rebaseReaderMutations([mutation], state, cloud, [{fromSentenceId: 'a', toSentenceIds: ['a1', 'a2']}, {fromSentenceId: 'b', toSentenceIds: ['b']}]).mutations[0]).toEqual({...mutation, documentRevision: 2, payload: {sentenceIds: ['a1', 'a2', 'b'], color: 'yellow'}});
  expect(rebaseReaderMutations([mutation], state, cloud, [{fromSentenceId: 'a', toSentenceIds: []}, {fromSentenceId: 'b', toSentenceIds: ['b']}]).recovery).toEqual([{mutationId: 'id', reason: 'removed_anchor'}]);
  expect(rebaseReaderMutations([mutation], state, cloud, [{fromSentenceId: 'a', toSentenceIds: Array.from({length: 501}, (_, i) => `s${i}`)}, {fromSentenceId: 'b', toSentenceIds: ['b']}]).recovery[0].reason).toBe('anchor_limit');
});
it('requires a choice for different pending colors merging into one target instead of picking an arbitrary winner', () => {
  const mutations: BulletinReaderMutation[] = [
    {...base, mutationId: 'red', kind: 'setHighlight', payload: {sentenceIds: ['a'], color: 'red'}},
    {...base, mutationId: 'blue', kind: 'setHighlight', payload: {sentenceIds: ['b'], color: 'blue'}}
  ];
  const result = rebaseReaderMutations(mutations, state, {...state, appliedRevision: 2, currentRevision: 2}, [{fromSentenceId: 'a', toSentenceIds: ['merged']}, {fromSentenceId: 'b', toSentenceIds: ['merged']}]);
  expect(result.recovery.map(item => item.mutationId)).toEqual(['red', 'blue']);
  expect(result.mutations).toEqual([]);
});
it('never guesses whether a newer note version came from migration or a concurrent cloud edit', () => {
  const note = {id: 'note', text: 'Original', sentenceIds: ['a'], inactiveAnchors: [], quote: 'Quote', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const previous = {...state, notes: [note]};
  const cloud = {...state, appliedRevision: 2, currentRevision: 2, notes: [{...note, sentenceIds: ['a1', 'a2'], version: 2}]};
  const mutation: BulletinReaderMutation = {...base, mutationId: 'id', kind: 'editNote', baseVersion: 1, payload: {noteId: 'note', text: 'Local'}};
  expect(rebaseReaderMutations([mutation], previous, cloud, []).recovery).toEqual([{mutationId: 'id', reason: 'note_conflict'}]);
  cloud.notes[0].text = 'Cloud';
  expect(rebaseReaderMutations([mutation], previous, cloud, []).recovery).toEqual([{mutationId: 'id', reason: 'note_conflict'}]);
  cloud.notes[0] = {...note, sentenceIds: ['a1', 'a2']};
  expect(rebaseReaderMutations([mutation], previous, cloud, []).mutations[0].baseVersion).toBe(1);
});
it('uses explicit current anchors and cloud version for manual recovery, never reusing a terminal ID', () => {
  const document = readerFixture().document;
  const cloud = {...state, currentRevision: document.revision, documentId: document.documentId, notes: [{id: 'note', text: 'Cloud', version: 3, deleted: false, sentenceIds: ['s0'], inactiveAnchors: [], quote: 'Quote', reanchorRequired: false, createdAt: '', updatedAt: ''}]};
  const original: BulletinReaderMutation = {...base, mutationId: 'old-id', kind: 'editNote', baseVersion: 1, payload: {noteId: 'note', text: 'Local'}};
  const recovered = manualReaderRecovery(original, cloud, document, {sentenceIds: [], text: 'Merged', color: 'yellow'});
  expect(recovered).toMatchObject({kind: 'editNote', baseVersion: 3, payload: {noteId: 'note', text: 'Merged'}});
  expect(recovered.mutationId).not.toBe(original.mutationId);
  const highlight: BulletinReaderMutation = {...base, mutationId: 'old', kind: 'setHighlight', payload: {sentenceIds: ['removed'], color: 'red'}};
  expect(() => manualReaderRecovery(highlight, cloud, document, {sentenceIds: ['removed'], text: '', color: 'blue'})).toThrow('invalid_reader_anchor');
  expect(manualReaderRecovery(highlight, cloud, document, {sentenceIds: ['s0', 's0'], text: '', color: 'blue'})).toMatchObject({payload: {sentenceIds: ['s0'], color: 'blue'}});
});
