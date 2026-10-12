import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ReaderLoading} from './ReaderLoading';
afterEach(() => {cleanup(); vi.useRealTimers();});
it('root loading keeps a non-interactive header without cached titles or member content', () => {
  const {container} = render(<ReaderLoading label="Loading bulletin…" overlay showHeader/>);
  const shell = container.firstChild;
  expect(shell).toHaveAttribute('aria-busy', 'true');
  expect(shell).toHaveAttribute('data-overlay', 'true');
  expect(container.querySelector('.reader-tabbar')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading bulletin…');
  expect(screen.queryByRole('button')).toBeNull();
  expect(container.querySelector('[data-sentence-id]')).toBeNull();
});
it('locks the loading surface immediately and delays only the icon', () => {
  vi.useFakeTimers(); const {container} = render(<ReaderLoading label="Loading bulletin…" overlay/>);
  expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
  expect(container.firstChild).toHaveAttribute('data-overlay', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading bulletin…');
  expect(container.querySelector('svg')).toBeNull();
  act(() => vi.advanceTimersByTime(250)); expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});
it('cleans the delayed icon timer on unmount', () => {
  vi.useFakeTimers(); const {unmount} = render(<ReaderLoading label="Loading"/>); unmount();
  expect(vi.getTimerCount()).toBe(0);
});
