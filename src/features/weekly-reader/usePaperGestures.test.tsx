import {useRef, useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {usePaperGestures} from './usePaperGestures';
function Harness({enabled = true, blocked = false}: {enabled?: boolean; blocked?: boolean}) {
  const root = useRef<HTMLDivElement>(null), [zoom, setZoom] = useState(1);
  const {changeZoom: change} = usePaperGestures({root, enabled, blocked, zoom, setZoom});
  return <div ref={root} data-testid="viewport"><output>{zoom.toFixed(2)}</output><button onClick={() => change(zoom + .25)}>Zoom</button><div data-paper-index="0">Text</div></div>;
}
it('intercepts modifier wheel only within an enabled paper viewport', () => {
  const {getByTestId, rerender} = render(<Harness/>);
  const root = getByTestId('viewport');
  expect(fireEvent.wheel(root, {deltaY: -100, ctrlKey: true})).toBe(false);
  expect(screen.getByRole('status')).not.toHaveTextContent('1.00');
  expect(fireEvent.wheel(root, {deltaY: 100})).toBe(true);
  rerender(<Harness enabled={false}/>);
  expect(fireEvent.wheel(root, {deltaY: -100, ctrlKey: true})).toBe(true);
});
it('leaves gestures alone while a note editor blocks the paper', () => {
  const {getByTestId} = render(<Harness blocked/>);
  expect(fireEvent.wheel(getByTestId('viewport'), {deltaY: -100, ctrlKey: true})).toBe(true);
  expect(screen.getByRole('status')).toHaveTextContent('1.00');
});
it('zooms with two touches and releases listeners on unmount', () => {
  const {getByTestId, unmount} = render(<Harness/>);
  const root = getByTestId('viewport');
  fireEvent.touchStart(root, {touches: [{clientX: 0, clientY: 0}, {clientX: 100, clientY: 0}]});
  expect(fireEvent.touchMove(root, {touches: [{clientX: 0, clientY: 0}, {clientX: 200, clientY: 0}]})).toBe(false);
  expect(screen.getByRole('status')).toHaveTextContent('2.00');
  fireEvent.touchCancel(root);
  expect(fireEvent.touchMove(root, {touches: [{clientX: 10, clientY: 0}]})).toBe(true);
  unmount();
  expect(fireEvent.wheel(root, {deltaY: -100, ctrlKey: true})).toBe(true);
});
it('compensates scroll to keep the same page-relative focal point after zoom', () => {
  const {getByTestId} = render(<Harness/>);
  const root = getByTestId('viewport'), page = root.querySelector<HTMLElement>('[data-paper-index]')!;
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 600));
  let expanded = false;
  vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() => expanded ? new DOMRect(0, 0, 800, 1600) : new DOMRect(0, 0, 400, 800));
  const scroll = vi.fn(); Object.defineProperty(root, 'scrollBy', {configurable: true, value: scroll});
  root.addEventListener('wheel', () => {expanded = true;});
  fireEvent.wheel(root, {deltaY: -350, ctrlKey: true, clientX: 100, clientY: 200});
  expect(scroll).toHaveBeenCalledWith({left: 100, top: 200, behavior: 'instant'});
});
it('preserves the page-relative point across a viewport resize without resetting the page', () => {
  function Resizable() {
    const root = useRef<HTMLDivElement>(null), [size, setSize] = useState(1);
    const gestures = usePaperGestures({root, enabled: true, blocked: false, zoom: 2, setZoom: () => {}, layoutKey: String(size)});
    return <div ref={root} data-testid="resizable" data-size={size}><button onClick={() => {gestures.captureAnchor({x: 100, y: 200}); setSize(2);}}>Resize</button><div data-paper-index="2"/></div>;
  }
  const {getByTestId} = render(<Resizable/>);
  const root = getByTestId('resizable'), page = root.querySelector<HTMLElement>('[data-paper-index]')!;
  vi.spyOn(page, 'getBoundingClientRect').mockImplementation(() => root.dataset.size === '2' ? new DOMRect(-100, -200, 800, 1600) : new DOMRect(-100, -200, 400, 800));
  const scroll = vi.fn(); Object.defineProperty(root, 'scrollBy', {configurable: true, value: scroll});
  fireEvent.click(screen.getByRole('button', {name: 'Resize'}));
  expect(scroll).toHaveBeenCalledWith({left: 200, top: 400, behavior: 'instant'});
});
