import {describe, expect, it} from 'vitest';
import {readerFixture} from './test-fixture';
import {readerSentences, toggleSentence, selectedColor} from './selection';

describe('reader sentence selection', () => {
  it('toggles a non-contiguous set in document order and rejects foreign anchors', () => {
    const index = readerSentences(readerFixture().document);
    let selected = toggleSentence([], 's3', index);
    selected = toggleSentence(selected, 's0', index);
    expect(selected).toEqual(['s0', 's3']);
    expect(toggleSentence(selected, 's0', index)).toEqual(['s3']);
    expect(toggleSentence(selected, 'foreign', index)).toEqual(selected);
  });
  it('uses actual rendered canonical text once, not PDF fields or duplicated page fragments', () => {
    const doc = readerFixture().document;
    const fixed = {box: {x: 0, y: 0, width: .3, height: .1}, style: {fontSize: 12, lineHeight: 16, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}};
    doc.content.layoutManifest.pages[0].fixedSlots = [
      {...fixed, id: 'issue', element: 'issueNumber'}, {...fixed, id: 'date', element: 'date'}
    ];
    doc.content.layoutManifest.pages[1].fixedSlots = [{...fixed, id: 'issue-again', element: 'issueNumber'}];
    expect(readerSentences(doc).slice(0, 2).map(s => [s.id, s.text])).toEqual([['canonical-issueNumber', '第1739期'], ['canonical-date', 'Sep.20.2026']]);
  });
  it('marks a swatch active only when all selected sentences share that saved color', () => {
    expect(selectedColor(['a', 'b'], {a: 'yellow', b: 'yellow'})).toBe('yellow');
    expect(selectedColor(['a', 'b'], {a: 'yellow', b: 'blue'})).toBeNull();
    expect(selectedColor(['a', 'b'], {a: 'yellow'})).toBeNull();
    expect(selectedColor([], {a: 'yellow'})).toBeNull();
  });
});
