import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {SelectionToolbar} from './SelectionToolbar';

it('shows one three-color group first, then Clear Copy Note, with mixed and active states', () => {
  const onColor = vi.fn(), onClear = vi.fn(), onCopy = vi.fn(), onNote = vi.fn();
  const props = {messages: getMessages('en').weeklyReader, count: 2, color: null, onColor, onClear, onCopy, onNote};
  const {rerender} = render(<SelectionToolbar {...props}/>);
  const buttons = screen.getAllByRole('button');
  expect(buttons.map(button => button.getAttribute('aria-label') || button.textContent)).toEqual(['Yellow highlight', 'Red highlight', 'Blue highlight', 'Clear', 'Copy', 'Note']);
  for (const button of buttons.slice(0, 3)) expect(button).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(buttons[1]); expect(onColor).toHaveBeenCalledWith('red');
  fireEvent.click(buttons[3]); expect(onClear).toHaveBeenCalledOnce();
  fireEvent.click(buttons[4]); expect(onCopy).toHaveBeenCalledOnce();
  fireEvent.click(buttons[5]); expect(onNote).toHaveBeenCalledOnce();
  rerender(<SelectionToolbar {...props} color="yellow"/>);
  expect(screen.getByRole('button', {name: 'Yellow highlight'})).toHaveAttribute('aria-pressed', 'true');
});
it('removes all selection actions with no selection or while a note sheet is open', () => {
  const props = {messages: getMessages('en').weeklyReader, count: 0, color: null, onColor: vi.fn(), onClear: vi.fn(), onCopy: vi.fn(), onNote: vi.fn()};
  const {rerender} = render(<SelectionToolbar {...props}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<SelectionToolbar {...props} count={2} noteOpen/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
