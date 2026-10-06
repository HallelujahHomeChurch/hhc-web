import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ReaderTypography, readTypography} from './ReaderTypography';
import {getMessages} from '@/i18n/messages';
afterEach(() => {cleanup(); localStorage.clear();});
it('disables out-of-range changes and tolerates invalid saved preferences', () => {
  localStorage.setItem('hhc-reader-typography', '{"size":999,"line":0}');
  expect(readTypography()).toEqual({size: 18, line: 1.8});
  const onChange = vi.fn(), m = getMessages('en').weeklyReader;
  render(<ReaderTypography value={{size: 28, line: 1.4}} onChange={onChange} messages={m}/>);
  expect(screen.getByRole('button', {name: m.fontIncrease})).toBeDisabled();
  expect(screen.getByRole('button', {name: m.lineDecrease})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: m.fontDecrease}));
  expect(onChange).toHaveBeenCalledWith({size: 26, line: 1.4});
});
