import {fireEvent, render, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {RangeHighlights} from './RangeHighlights';

const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
afterEach(() => {
  vi.restoreAllMocks(); document.body.replaceChildren();
  if (originalRects) Object.defineProperty(Range.prototype, 'getClientRects', originalRects);
  else Reflect.deleteProperty(Range.prototype, 'getClientRects');
});
it('paints mounted partial ranges and lets a tap reopen that exact range without replacing text', async () => {
  const root = document.createElement('div');
  root.innerHTML = '<span data-sentence-id="a" data-fragment-start="0" data-fragment-end="4">甲乙丙丁</span>';
  document.body.append(root);
  Object.defineProperty(Range.prototype, 'getClientRects', {configurable: true, value: () => [new DOMRect(10, 20, 30, 16), new DOMRect(10, 20, 30, 16)]});
  const onSelect = vi.fn();
  const {container} = render(<RangeHighlights root={{current: root}} layoutKey="p1" highlights={[{sentenceId: 'a', quote: '甲乙丙丁', color: 'yellow', segments: [{start: 1, end: 3, color: 'red'}], active: true, version: 1, updatedAt: ''}]} onSelect={onSelect}/>);
  await waitFor(() => expect(container.querySelector('[data-reader-highlight="red"]')).not.toBeNull());
  expect(container.querySelectorAll('[data-reader-highlight="red"]')).toHaveLength(1);
  expect(root.textContent).toBe('甲乙丙丁');
  fireEvent.click(root.firstChild!, {clientX: 15, clientY: 25});
  expect(onSelect).toHaveBeenCalledWith({sentenceId: 'a', start: 1, end: 3});
});
