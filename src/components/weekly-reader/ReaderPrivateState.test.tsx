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

it('keeps the sheet frame within the visual viewport when the keyboard reduces available height', () => {
  const visual = Object.assign(new EventTarget(), {height: 844, offsetTop: 0});
  vi.stubGlobal('innerHeight', 844); vi.stubGlobal('visualViewport', visual);
  render(<ReaderPrivateState wide={false} theme="light" messages={getMessages('en').weeklyReader} onClose={() => {}}>Notes</ReaderPrivateState>);
  const overlay = screen.getByRole('dialog').closest<HTMLElement>('.hhc-modal-overlay')!;
  expect(overlay.style.getPropertyValue('--reader-sheet-height')).toBe('720px');
  visual.height = 400; visual.offsetTop = 20; visual.dispatchEvent(new Event('resize'));
  expect(overlay.style.getPropertyValue('--reader-sheet-height')).toBe('300px');
  expect(overlay.style.getPropertyValue('--reader-sheet-bottom')).toBe('424px');
});
