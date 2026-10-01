import {describe, expect, it} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {applyLocalMutation, optimisticReaderState, verifyPrivateState} from './private-state';
import {readerFixture} from './test-fixture';

const document = readerFixture().document;
const state = (): BulletinReaderState => ({accountId: 'account-a', documentId: document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [
  {sentenceId: 's0', color: 'red', quote: '內容0。', active: true, version: 1, updatedAt: '2026-10-02T00:00:00Z'}
], notes: [{id: 'note', text: '私人筆記', sentenceIds: ['s0'], inactiveAnchors: [], quote: '內容0。', version: 1, deleted: false, reanchorRequired: false, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z'}], progress: null, conflicts: []});
const base = {mutationId: '00000000-0000-4000-8000-000000000010', documentRevision: 1, createdAt: '2026-10-02T01:00:00Z'};
describe('private reader state', () => {
  it('replaces mixed colors atomically, preserves notes on Clear, and never mutates the rollback snapshot', () => {
    const original = state();
    const changed = optimisticReaderState(original, {...base, kind: 'setHighlight', payload: {sentenceIds: ['s0', 's1'], color: 'blue'}}, document);
    expect(changed.highlights.map(h => h.color)).toEqual(['blue', 'blue']);
    expect(original.highlights).toHaveLength(1);
    expect(original.highlights[0].color).toBe('red');
    const cleared = optimisticReaderState(changed, {...base, kind: 'clearHighlight', payload: {sentenceIds: ['s0', 's1']}}, document);
    expect(cleared.highlights).toEqual([]);
    expect(cleared.notes).toEqual(original.notes);
  });
  it('rejects foreign anchors, mismatched revisions and unresolved migration conflicts without partial writes', () => {
    const mutation: BulletinReaderMutation = {...base, kind: 'setHighlight', payload: {sentenceIds: ['s0', 'foreign'], color: 'yellow'}};
    const original = state();
    expect(() => optimisticReaderState(original, mutation, document)).toThrow();
    expect(() => optimisticReaderState({...original, currentRevision: 2}, {...mutation, payload: {sentenceIds: ['s0'], color: 'yellow'}}, document)).toThrow();
    original.conflicts = [{id: 'conflict', sentenceIds: ['s0'], sources: original.highlights}];
    expect(() => optimisticReaderState(original, {...mutation, payload: {sentenceIds: ['s0'], color: 'yellow'}}, document)).toThrow();
    expect(original.highlights[0].color).toBe('red');
  });
  it('binds cloud state to the account and document, allowing only a newer current revision for recovery', () => {
    expect(verifyPrivateState(state(), 'account-a', document.documentId, 1)).toEqual(state());
    expect(() => verifyPrivateState(state(), 'account-b', document.documentId, 1)).toThrow('invalid_reader_binding');
    expect(() => verifyPrivateState(state(), 'account-a', 'other', 1)).toThrow('invalid_reader_binding');
    expect(() => verifyPrivateState({...state(), appliedRevision: 2}, 'account-a', document.documentId, 1)).toThrow();
    expect(verifyPrivateState({...state(), appliedRevision: 2, currentRevision: 2}, 'account-a', document.documentId, 1).currentRevision).toBe(2);
  });
  it('does not optimistically finish a note before a durable acknowledgement', () => {
    const original = state();
    expect(optimisticReaderState(original, {...base, kind: 'editNote', baseVersion: 1, payload: {noteId: 'note', text: '未儲存'}}, document)).toEqual(original);
  });
  it('projects durable note operations with multiple notes, version checks and retained inactive quotes', () => {
    const original = state();
    const created = applyLocalMutation(original, {...base, kind: 'createNote', payload: {noteId: 'new-note', sentenceIds: ['s0'], text: '第二則'}}, document);
    expect(created.notes).toHaveLength(2);
    const inactive = {...created, notes: created.notes.map(note => ({...note, sentenceIds: [], inactiveAnchors: [{sentenceId: 's0', componentId: 'c0', pageId: 'p0', quote: note.quote}]}))};
    const edited = applyLocalMutation(inactive, {...base, kind: 'editNote', baseVersion: 1, payload: {noteId: 'new-note', text: '保留原文'}}, document);
    expect(edited.notes[1]).toMatchObject({text: '保留原文', quote: '內容0。', version: 2});
    expect(() => applyLocalMutation(edited, {...base, kind: 'deleteNote', baseVersion: 1, payload: {noteId: 'new-note'}}, document)).toThrow('note_conflict');
    expect(applyLocalMutation(edited, {...base, kind: 'deleteNote', baseVersion: 2, payload: {noteId: 'new-note'}}, document).notes[1]).toMatchObject({deleted: true, text: '', quote: '', sentenceIds: []});
    expect(original.notes).toHaveLength(1);
  });
});
