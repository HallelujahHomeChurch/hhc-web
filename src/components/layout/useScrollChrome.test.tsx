import {act, renderHook} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {useScrollChrome} from './useScrollChrome';
it('hides on downward scroll, reveals upward, and ignores programmatic reader jumps until user input', () => {
  const root = document.createElement('div');
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {callback(0); return 0;});
  const {result, unmount} = renderHook(() => useScrollChrome({root: {current: root}}));
  act(() => {root.scrollTop = 60; root.dispatchEvent(new Event('scroll'));});
  expect(result.current.visible).toBe(false);
  act(() => {root.scrollTop = 40; root.dispatchEvent(new Event('scroll'));});
  expect(result.current.visible).toBe(true);
  act(() => {result.current.reveal(); root.scrollTop = 300; root.dispatchEvent(new Event('scroll'));});
  expect(result.current.visible).toBe(true);
  act(() => {root.dispatchEvent(new Event('wheel')); root.scrollTop = 330; root.dispatchEvent(new Event('scroll'));});
  expect(result.current.visible).toBe(false);
  unmount(); vi.restoreAllMocks();
});
