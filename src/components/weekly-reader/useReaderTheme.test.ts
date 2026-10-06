import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useReaderTheme} from './useReaderTheme';

afterEach(() => {cleanup(); vi.restoreAllMocks(); localStorage.removeItem('hhc-reader-theme'); delete document.documentElement.dataset.theme;});
it('initializes from the site once and retains its independent choice on reopening', () => {
  document.documentElement.dataset.theme = 'dark';
  const first = renderHook(useReaderTheme);
  expect(first.result.current.theme).toBe('dark');
  first.unmount();
  document.documentElement.dataset.theme = 'light';
  const next = renderHook(useReaderTheme);
  expect(next.result.current.theme).toBe('dark');
  act(() => next.result.current.toggle());
  expect(next.result.current.theme).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
});
it('ignores invalid saved values and can toggle when storage is blocked', () => {
  localStorage.setItem('hhc-reader-theme', 'invalid');
  document.documentElement.dataset.theme = 'dark';
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('blocked');});
  const {result} = renderHook(useReaderTheme);
  expect(result.current.theme).toBe('dark');
  act(() => result.current.toggle());
  expect(result.current.theme).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('dark');
});
