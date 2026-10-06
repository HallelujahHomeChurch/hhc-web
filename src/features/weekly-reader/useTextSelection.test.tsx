import {useRef} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useTextSelection} from './useTextSelection';

const sentences = [{id: 's', componentId: 'c', text: 'abcdefgh'}];
function Harness() {
  const root = useRef<HTMLDivElement>(null);
  const {selection, selecting} = useTextSelection(root, sentences, {ids: []}, false);
  return <><div ref={root} tabIndex={0}><span data-sentence-id="s" data-fragment-start="0" data-fragment-end="8">abcdefgh</span></div>{selection.ids.length && !selecting ? <button>Annotate</button> : null}</>;
}
function select(end: number) {
  const element = screen.getByText('abcdefgh');
  const range = document.createRange();
  range.setStart(element.firstChild!, 0); range.setEnd(element.firstChild!, end);
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  return element;
}
afterEach(() => {cleanup(); vi.useRealTimers(); window.getSelection()?.removeAllRanges();});

it('waits for touch release when the OS takes over a long-press selection', () => {
  vi.useFakeTimers(); render(<Harness/>);
  const text = screen.getByText('abcdefgh');
  fireEvent.pointerDown(text, {pointerId: 1, pointerType: 'touch'});
  fireEvent.touchStart(text, {touches: [{identifier: 1}]});
  select(3);
  fireEvent.pointerCancel(text, {pointerId: 1, pointerType: 'touch'});
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  fireEvent.touchEnd(text, {touches: []});
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});

it('waits for keyboard selection to finish and hides again while extending it', () => {
  vi.useFakeTimers(); render(<Harness/>);
  const text = screen.getByText('abcdefgh');
  fireEvent.keyDown(text, {key: 'ArrowRight', shiftKey: true}); select(3);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  fireEvent.keyUp(text, {key: 'ArrowRight', shiftKey: true});
  expect(screen.getByText('Annotate')).toBeInTheDocument();
  fireEvent.keyDown(text, {key: 'ArrowRight', shiftKey: true}); select(4);
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  fireEvent.keyUp(text, {key: 'Shift'});
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});

it('debounces native handle changes that do not expose pointer events', () => {
  vi.useFakeTimers(); render(<Harness/>); select(2);
  act(() => vi.advanceTimersByTime(100)); select(4);
  act(() => vi.advanceTimersByTime(100));
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});
