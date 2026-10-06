import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {HighlightsPanel} from './HighlightsPanel';

afterEach(cleanup);
const messages = getMessages('en').weeklyReader;
const sentence = {id: 's1', componentId: 'c1', text: '甲😀乙。'};
const highlight = {sentenceId: 's1', quote: '甲😀乙。', color: 'yellow' as const, active: true, version: 1, updatedAt: ''};

it('preserves Unicode scalar offsets for legacy full-sentence highlights', async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  render(<HighlightsPanel highlights={[highlight]} sentences={[sentence]} messages={messages} busy={false} onChange={onChange}/>);
  await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
  expect(onChange).toHaveBeenCalledWith({sentenceId: 's1', start: 0, end: 4}, null);
});

it('shows only active anchored segments and disables mutations while syncing', () => {
  render(<HighlightsPanel highlights={[{...highlight, segments: [{start: 1, end: 2, color: 'blue'}]}, {...highlight, sentenceId: 'missing'}, {...highlight, active: false, sentenceId: 'inactive'}]} sentences={[sentence]} messages={messages} busy onChange={vi.fn()}/>);
  expect(screen.getByText('😀')).toBeInTheDocument();
  const list = screen.getByRole('region', {name: 'Highlights'});
  expect(within(list).getAllByRole('article')).toHaveLength(1);
  for (const button of within(list).getAllByRole('button')) expect(button).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Blue highlight'})).toHaveAttribute('aria-pressed', 'true');
});

it('offers an empty state instead of controls for missing or inactive anchors', () => {
  render(<HighlightsPanel highlights={[{...highlight, active: false}]} sentences={[sentence]} messages={messages} busy={false} onChange={vi.fn()}/>);
  expect(screen.getByText(messages.highlightsEmpty)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
