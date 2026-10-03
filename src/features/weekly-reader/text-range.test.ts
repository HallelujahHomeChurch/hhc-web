import {afterEach, describe, expect, it} from 'vitest';
import {readTextSelection, rangeQuote, renderedTextRanges} from './text-range';
import type {ReaderSentence} from './selection';

const sentences: ReaderSentence[] = [
  {id: 'a', componentId: 'body', text: '甲😀乙丙丁'},
  {id: 'b', componentId: 'body', text: '第二句。'},
  {id: 'c', componentId: 'next', text: '第三句。'}
];
function fixture(html: string) {
  const root = document.createElement('section');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}
function select(start: Node, startOffset: number, end: Node, endOffset: number) {
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(start, startOffset); range.setEnd(end, endOffset);
  selection.addRange(range);
  return selection;
}
afterEach(() => {window.getSelection()?.removeAllRanges(); document.body.replaceChildren();});

describe('canonical native text selection', () => {
  it('maps persisted scalar offsets back to only visible DOM fragments across fonts', () => {
    const root = fixture('<span data-sentence-id="a" data-fragment-start="1" data-fragment-end="4"><em>😀</em><strong>乙丙</strong></span>');
    expect(renderedTextRanges(root, {sentenceId: 'a', start: 0, end: 3}).map(range => range.toString())).toEqual(['😀乙']);
    expect(renderedTextRanges(root, {sentenceId: 'foreign', start: 0, end: 2})).toEqual([]);
  });
  it('converts DOM UTF-16 offsets across typography into scalar offsets and exact quote', () => {
    const root = fixture('<span data-sentence-id="a" data-fragment-start="0" data-fragment-end="5"><em>甲😀</em><strong>乙丙丁</strong></span>');
    const selection = select(root.querySelector('em')!.firstChild!, 1, root.querySelector('strong')!.firstChild!, 1);
    const ranges = readTextSelection(root, selection, sentences);
    expect(ranges).toEqual([{sentenceId: 'a', start: 1, end: 3}]);
    expect(rangeQuote(ranges, sentences)).toBe('😀乙');
    selection.setBaseAndExtent(root.querySelector('strong')!.firstChild!, 1, root.querySelector('em')!.firstChild!, 1);
    expect(readTextSelection(root, selection, sentences)).toEqual(ranges);
  });

  it('combines adjacent fragments without selecting unmounted text', () => {
    const root = fixture('<span data-sentence-id="a" data-fragment-start="1" data-fragment-end="3">😀乙</span><span data-sentence-id="a" data-fragment-start="3" data-fragment-end="4">丙</span>');
    expect(readTextSelection(root, select(root, 0, root, 2), sentences)).toEqual([{sentenceId: 'a', start: 1, end: 4}]);
  });

  it('preserves a continuous cross-sentence range and component breaks in copied quotes', () => {
    const root = fixture('<span data-sentence-id="a" data-fragment-start="0" data-fragment-end="5">甲😀乙丙丁</span><span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span><span data-sentence-id="c" data-fragment-start="0" data-fragment-end="4">第三句。</span>');
    const ranges = readTextSelection(root, select(root.children[0].firstChild!, 4, root.children[2].firstChild!, 2), sentences);
    expect(ranges).toEqual([{sentenceId: 'a', start: 3, end: 5}, {sentenceId: 'b', start: 0, end: 4}, {sentenceId: 'c', start: 0, end: 2}]);
    expect(rangeQuote(ranges, sentences)).toBe('丙丁第二句。\n\n第三');
  });

  it('rejects a collapsed or cross-reader selection instead of capturing unrelated text', () => {
    const root = fixture('<span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span>');
    const outside = fixture('private outside text');
    expect(readTextSelection(root, null, sentences)).toEqual([]);
    expect(readTextSelection(root, select(root.firstChild!.firstChild!, 1, root.firstChild!.firstChild!, 1), sentences)).toEqual([]);
    expect(readTextSelection(root, select(root.firstChild!.firstChild!, 1, outside.firstChild!, 2), sentences)).toEqual([]);
  });

  it.each([
    '<span data-sentence-id="unknown" data-fragment-start="0" data-fragment-end="4">第二句。</span>',
    '<span data-sentence-id="b" data-fragment-start="0" data-fragment-end="99">第二句。</span>',
    '<span data-sentence-id="b" data-fragment-start="-1" data-fragment-end="3">第二句。</span>',
    '<span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">偽造文字</span>',
    '<div inert><span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span></div>',
    '<div hidden><span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span></div>',
    '<div aria-hidden="true"><span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span></div>'
  ])('rejects foreign, malformed or unavailable rendered fragments: %s', html => {
    const root = fixture(html);
    expect(readTextSelection(root, select(root, 0, root, 1), sentences)).toEqual([]);
  });

  it('rejects surrogate-split boundaries rather than highlighting the wrong character', () => {
    const root = fixture('<span data-sentence-id="a" data-fragment-start="0" data-fragment-end="5">甲😀乙丙丁</span>');
    expect(readTextSelection(root, select(root.firstChild!.firstChild!, 2, root.firstChild!.firstChild!, 4), sentences)).toEqual([]);
  });

  it.each([
    '<span data-sentence-id="a" data-fragment-start="0" data-fragment-end="1">甲</span><span data-sentence-id="a" data-fragment-start="2" data-fragment-end="3">乙</span>',
    '<span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span><span data-sentence-id="b" data-fragment-start="0" data-fragment-end="4">第二句。</span>',
    '<span data-sentence-id="a" data-fragment-start="0" data-fragment-end="5">甲😀乙丙丁</span><span data-sentence-id="c" data-fragment-start="0" data-fragment-end="4">第三句。</span>'
  ])('rejects duplicate or discontinuous text rather than widening it: %s', html => {
    const root = fixture(html);
    expect(readTextSelection(root, select(root, 0, root, 2), sentences)).toEqual([]);
  });

  it('rejects invalid quote anchors and keeps the 500 sentence bound', () => {
    expect(() => rangeQuote([{sentenceId: 'a', start: 1.5, end: 3}], sentences)).toThrow();
    expect(() => rangeQuote([{sentenceId: 'a', start: 0, end: 6}], sentences)).toThrow();
    expect(() => rangeQuote([{sentenceId: 'foreign', start: 0, end: 1}], sentences)).toThrow();
    expect(() => rangeQuote([{sentenceId: 'a', start: 3, end: 3}], sentences)).toThrow();
    const many = Array.from({length: 501}, (_, i) => ({id: `s${i}`, text: '文', componentId: 'body'}));
    expect(() => rangeQuote(many.map(s => ({sentenceId: s.id, start: 0, end: 1})), many)).toThrow();
  });
});
