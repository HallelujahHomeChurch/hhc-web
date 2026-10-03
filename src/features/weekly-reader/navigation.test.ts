import {describe, expect, it} from 'vitest';
import {pageScale, swipeDirection, keyboardPageDelta, centeredBodyOffset} from './navigation';
import {readerFixture} from './test-fixture';
describe('reader navigation', () => {
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
    expect(pageScale('page', {width: 600, height: 800}, {width: 900, height: 600})).toBe(.75);
    expect(pageScale('width', {width: 600, height: 800}, {width: 900, height: 600})).toBe(1.5);
    expect(pageScale(10, {width: 600, height: 800}, {width: 900, height: 600})).toBe(2.5);
    expect(pageScale(.1, {width: 600, height: 800}, {width: 900, height: 600})).toBe(.75);
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
