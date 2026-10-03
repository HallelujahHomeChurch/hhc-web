import {expect, it} from 'vitest';
import {selectedHighlight} from './highlight-selection';

it('reports partial coverage and mixed colors without claiming a uniform highlight', () => {
  const saved = [{sentenceId: 'a', quote: '甲乙丙丁', active: true, color: 'yellow' as const, version: 1, updatedAt: '', segments: [{start: 0, end: 2, color: 'yellow' as const}, {start: 2, end: 3, color: 'red' as const}]}];
  expect(selectedHighlight([{sentenceId: 'a', start: 0, end: 2}], saved)).toEqual({color: 'yellow', clearable: true});
  expect(selectedHighlight([{sentenceId: 'a', start: 0, end: 3}], saved)).toEqual({color: null, clearable: true});
  expect(selectedHighlight([{sentenceId: 'a', start: 2, end: 4}], saved)).toEqual({color: null, clearable: true});
  expect(selectedHighlight([{sentenceId: 'a', start: 3, end: 4}], saved)).toEqual({color: null, clearable: false});
  expect(selectedHighlight([{sentenceId: 'a', start: 0, end: 2}], [{...saved[0], active: false}])).toEqual({color: null, clearable: false});
});
