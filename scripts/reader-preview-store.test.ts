import {expect, it} from 'vitest';
import {createReaderPreviewStore} from './reader-preview-store';
import {readerFixture} from '../src/features/weekly-reader/test-fixture';

it('simulates range writes/reloads, deduplicates retries and isolates documents in memory', () => {
  const store = createReaderPreviewStore();
  const document = readerFixture().document;
  const mutation = {mutationId: 'a', createdAt: new Date().toISOString(), documentRevision: document.revision, kind: 'setHighlight' as const, payload: {sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 1, end: 3}], color: 'yellow' as const}};
  const first = store.mutate(document, [mutation]);
  expect(first.state.highlights[0].segments).toEqual([{start: 1, end: 3, color: 'yellow'}]);
  expect(store.mutate(document, [mutation])).toEqual(first);
  expect(store.read(document).highlights).toEqual(first.state.highlights);
  expect(store.read({...document, documentId: 'other'}).highlights).toEqual([]);
  expect(() => store.mutate(document, [{...mutation, payload: {...mutation.payload, color: 'red'}}])).toThrow('mutation_reuse');
  store.failNext();
  expect(() => store.mutate(document, [{...mutation, mutationId: 'next'}])).toThrow('simulated_failure');
  expect(store.mutate(document, [{...mutation, mutationId: 'next'}]).results[0].status).toBe('applied');
  expect(createReaderPreviewStore().read(document).highlights).toEqual([]);
});
