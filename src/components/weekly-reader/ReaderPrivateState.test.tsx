import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {ReaderPrivateState} from './ReaderPrivateState';
import {getMessages} from '@/i18n/messages';
afterEach(cleanup);
it('keeps the portal notes surface on the reader theme, independent of the website', () => {
  const {rerender} = render(<ReaderPrivateState wide={false} theme="dark" messages={getMessages('en').weeklyReader} onClose={() => {}}>Notes</ReaderPrivateState>);
  expect(screen.getByRole('dialog').closest('.hhc-modal-overlay')).toHaveAttribute('data-theme', 'dark');
  rerender(<ReaderPrivateState wide={false} theme="light" messages={getMessages('en').weeklyReader} onClose={() => {}}>Notes</ReaderPrivateState>);
  expect(screen.getByRole('dialog').closest('.hhc-modal-overlay')).toHaveAttribute('data-theme', 'light');
});
