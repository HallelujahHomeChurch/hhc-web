import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ReaderPrivateState} from './ReaderPrivateState';
import {getMessages} from '@/i18n/messages';
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
it('keeps the portal notes surface on the reader theme, independent of the website', () => {
  const {rerender} = render(<ReaderPrivateState wide={false} theme="dark" messages={getMessages('en').weeklyReader} onClose={() => {}}>Notes</ReaderPrivateState>);
  expect(screen.getByRole('dialog').closest('.hhc-modal-overlay')).toHaveAttribute('data-theme', 'dark');
  rerender(<ReaderPrivateState wide={false} theme="light" messages={getMessages('en').weeklyReader} onClose={() => {}}>Notes</ReaderPrivateState>);
  expect(screen.getByRole('dialog').closest('.hhc-modal-overlay')).toHaveAttribute('data-theme', 'light');
});

it('leaves visual viewport ownership with the house modal and measures only the header gap', () => {
  const header = document.createElement('header');
  Object.defineProperty(header, 'offsetHeight', {configurable: true, value: 52});
  render(<ReaderPrivateState headerRef={{current: header}} wide={false} theme="light" messages={getMessages('en').weeklyReader} onClose={() => {}}>Notes</ReaderPrivateState>);
  const overlay = screen.getByRole('dialog').closest<HTMLElement>('.hhc-modal-overlay')!;
  expect(overlay.style.getPropertyValue('--reader-sheet-gap')).toBe('68px');
  expect(overlay.style.getPropertyValue('--reader-viewport-top')).toBe('');
  expect(overlay.style.getPropertyValue('--reader-viewport-height')).toBe('');
  Object.defineProperty(header, 'offsetHeight', {configurable: true, value: 88});
  window.dispatchEvent(new Event('resize'));
  expect(overlay.style.getPropertyValue('--reader-sheet-gap')).toBe('104px');
});
