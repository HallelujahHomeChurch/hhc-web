import {useRef} from 'react';
import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ChapterPull} from './ChapterPull';
afterEach(cleanup);
it.each(['next', 'previous', 'middle', 'short', 'cancel', 'pinch', 'blocked'])('handles boundary gesture %s without adding a blank footer', mode => {
  const next = vi.fn(), previous = vi.fn();
  function Harness() {
    const root = useRef<HTMLDivElement>(null);
    return <div ref={root}><p>Text</p><ChapterPull root={root} blocked={mode === 'blocked'} onNext={next} onPrevious={previous}/></div>;
  }
  const {container} = render(<Harness/>);
  const root = container.firstElementChild!;
  Object.defineProperties(root, {scrollHeight: {value: 1000}, clientHeight: {value: 400}, scrollTop: {value: mode === 'previous' ? 0 : mode === 'middle' ? 300 : 600, writable: true}});
  const touch = (y: number) => ({identifier: 1, clientX: 100, clientY: y});
  fireEvent.touchStart(root, {touches: [touch(200)]});
  if (mode === 'pinch') fireEvent.touchStart(root, {touches: [touch(200), {...touch(210), identifier: 2}]});
  expect(next).not.toHaveBeenCalled();
  if (mode === 'cancel') fireEvent.touchCancel(root);
  fireEvent.touchEnd(root, {touches: [], changedTouches: [touch(mode === 'previous' ? 300 : mode === 'short' ? 180 : 100)]});
  expect(next).toHaveBeenCalledTimes(mode === 'next' ? 1 : 0);
  expect(previous).toHaveBeenCalledTimes(mode === 'previous' ? 1 : 0);
  expect(root.children).toHaveLength(1);
});
