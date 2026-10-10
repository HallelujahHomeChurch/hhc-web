import {useRef} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useTextSelection} from './useTextSelection';

const sentences = [{id: 's', componentId: 'c', text: 'abcdefgh'}];
function Harness() {
  const root = useRef<HTMLDivElement>(null);
  const {selection, selecting} = useTextSelection(root, sentences, {ids: []}, false);
  return <><div ref={root} tabIndex={0}><span data-sentence-id="s" data-fragment-start="0" data-fragment-end="8">abcdefgh</span><div>Paper margin</div></div><div>Outside paper</div>{selection.ids.length && !selecting ? <button className="reader-selection-tools">Annotate</button> : null}</>;
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

it('dismisses selection by tapping an unselected paper margin and permits selecting again', () => {
  vi.useFakeTimers(); render(<Harness/>); select(3);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByText('Annotate')).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByText('Paper margin'));
  fireEvent.pointerUp(screen.getByText('Paper margin'));
  fireEvent.click(screen.getByText('Paper margin'));
  expect(window.getSelection()?.toString()).toBe('');
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  select(3); act(() => vi.advanceTimersByTime(200));
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});

it('releases cancelled native touches even when touchcancel reports the cancelled contact', () => {
  vi.useFakeTimers(); render(<Harness/>);
  const text = screen.getByText('abcdefgh');
  fireEvent.pointerDown(text, {pointerId: 1, pointerType: 'touch'});
  fireEvent.touchStart(text, {touches: [{identifier: 1}]}); select(3);
  fireEvent.pointerCancel(text, {pointerId: 1, pointerType: 'touch'});
  fireEvent.touchCancel(text, {touches: [{identifier: 1}]});
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});

it('resets gesture bookkeeping when dismissed outside, without losing a subsequent selection', () => {
  vi.useFakeTimers(); render(<Harness/>);
  const text = screen.getByText('abcdefgh');
  fireEvent.pointerDown(text, {pointerId: 1, pointerType: 'touch'});
  fireEvent.touchStart(text, {touches: [{identifier: 1}]}); select(3);
  fireEvent.pointerDown(screen.getByText('Outside paper'));
  expect(window.getSelection()?.toString()).toBe('');
  select(4); act(() => vi.advanceTimersByTime(200));
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});

it('keeps captured text when pressing annotation controls', () => {
  vi.useFakeTimers(); render(<Harness/>); select(3);
  act(() => vi.advanceTimersByTime(200));
  fireEvent.pointerDown(screen.getByText('Annotate'));
  window.getSelection()?.removeAllRanges(); fireEvent(document, new Event('selectionchange'));
  fireEvent.click(screen.getByText('Annotate'));
  expect(screen.getByText('Annotate')).toBeInTheDocument();
});

it.each(['pointer', 'touch'])('preserves repeated same-range drag selections including their final click via %s', kind => {
  vi.useFakeTimers(); render(<Harness/>);
  const text = screen.getByText('abcdefgh');
  for (let attempt = 0; attempt < 2; attempt++) {
    if (kind === 'pointer') fireEvent(text, new MouseEvent('pointerdown', {bubbles: true, clientX: 10, clientY: 10}));
    else fireEvent.touchStart(text, {touches: [{identifier: 1, clientX: 10, clientY: 10}]});
    select(3);
    if (kind === 'pointer') fireEvent(text, new MouseEvent('pointerup', {bubbles: true, clientX: 50, clientY: 10}));
    else {
      fireEvent.touchMove(text, {touches: [{identifier: 1, clientX: 50, clientY: 10}]});
      fireEvent.touchEnd(text, {touches: [], changedTouches: [{identifier: 1, clientX: 50, clientY: 10}]});
    }
    fireEvent.click(text, {clientX: 50, clientY: 10});
    act(() => vi.advanceTimersByTime(200));
    expect(window.getSelection()?.toString()).toBe('abc');
    expect(screen.getByText('Annotate')).toBeInTheDocument();
  }
});
