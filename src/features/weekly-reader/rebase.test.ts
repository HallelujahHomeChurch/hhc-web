import {expect, it} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {rebaseReaderMutations, manualReaderRecovery} from './rebase';
import {readerFixture} from './test-fixture';

const state: BulletinReaderState = {accountId: 'a', documentId: 'd', appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const base = {createdAt: '2026-10-02T00:00:00Z', documentRevision: 1};
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
