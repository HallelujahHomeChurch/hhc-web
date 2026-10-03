import {describe, expect, it} from 'vitest';
import {fittedPageScale, clampPaperZoom, swipeDirection, keyboardPageDelta, centeredBodyOffset, sourcePageStart, sourcePageForSentence} from './navigation';
import {readerFixture} from './test-fixture';
describe('reader navigation', () => {
  it('tracks the visible source fragment rather than the first page containing its sentence', () => {
    const doc = readerFixture().document.content;
    doc.layoutManifest.pages[0].slots[0].fragments = [{sentenceId: 's0', start: 0, end: 2}];
    doc.layoutManifest.pages[1].slots[0].fragments = [{sentenceId: 's0', start: 2, end: 4}];
    const root = document.createElement('div');
    root.innerHTML = '<span data-sentence-id="s0" data-fragment-start="0" data-fragment-end="4">內容0。</span>';
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () {return [{top: this.startOffset === 0 ? -100 : 100, bottom: this.startOffset === 0 ? -20 : 130}] as unknown as DOMRectList;};
    try {expect(sourcePageForSentence(root, doc, 's0', 72, 600)).toBe(1);} finally {Range.prototype.getClientRects = original;}
  });
  it('uses the exact first source fragment, including a sentence continuing on the next page', () => {
    const doc = readerFixture().document.content;
    doc.layoutManifest.pages[2].slots[0].fragments = [{sentenceId: 's1', start: 8, end: 12}];
    expect(sourcePageStart(doc, 2)).toEqual({sentenceId: 's1', start: 8, end: 9});
    expect(sourcePageStart(doc, 90)).toBeUndefined();
  });
  it('centers body text using translation only, without changing widths, fragments or pages', () => {
    const document = readerFixture().document.content;
    expect(centeredBodyOffset(document, 'p0')).toBe(0);
    const block = document.components[0].type === 'backSummary' ? document.components[0].items[0].blocks[0] : null;
    if (!block) throw new Error('fixture');
    document.components[0] = {id: 'c0', type: 'bodySection', bodySection: {kind: 'sermon', title: block, blocks: []}};
    document.layoutManifest.pages[0].slots[0].box = {x: .14, y: .1, width: .8, height: .1};
    const before = structuredClone(document);
    expect(centeredBodyOffset(document, 'p0')).toBeCloseTo(-.04);
    expect(document).toEqual(before);
  });
  it('fits the available viewport and bounds explicit zoom', () => {
    expect(fittedPageScale({width: 600, height: 800}, {width: 900, height: 600})).toBe(.75);
    expect(fittedPageScale({width: 600, height: 800}, {width: 300, height: 900})).toBe(.5);
    expect(clampPaperZoom(8)).toBe(4);
    expect(clampPaperZoom(.5)).toBe(1);
    expect(clampPaperZoom(NaN)).toBe(1);
  });
  it('leaves pinch, zoomed pan, vertical scroll and native selection alone', () => {
    const swipe = {dx: -100, dy: 5, multiplePointers: false, zoomed: false, hasSelection: false};
    expect(swipeDirection(swipe)).toBe(1);
    expect(swipeDirection({...swipe, dx: 100})).toBe(-1);
    for (const change of [{multiplePointers: true}, {zoomed: true}, {hasSelection: true}, {dy: 80}, {dx: 8}]) expect(swipeDirection({...swipe,...change})).toBe(0);
  });
  it('never steals input/editable arrows or selected text keys', () => {
    const event = {key: 'ArrowRight', target: document.createElement('div'), ctrlKey: false, metaKey: false, altKey: false};
    expect(keyboardPageDelta(event, false)).toBe(1);
    expect(keyboardPageDelta({...event, target: document.createElement('input')}, false)).toBe(0);
    const editable = document.createElement('div'); editable.setAttribute('contenteditable', 'true');
    expect(keyboardPageDelta({...event, target: editable}, false)).toBe(0);
    expect(keyboardPageDelta(event, true)).toBe(0);
  });
});
