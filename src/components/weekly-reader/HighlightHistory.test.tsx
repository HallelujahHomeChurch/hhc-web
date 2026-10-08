import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {HighlightHistory} from './HighlightHistory';

const messages = getMessages('en').weeklyReader;
const history = [{id: 'old', highlight: {sentenceId: 'gone', quote: '甲😀乙', color: 'red' as const, active: false, version: 1, updatedAt: '', segments: [{start: 1, end: 2, color: 'red' as const}]}}, {id: 'consumed'}];
it('renders only retained history and requires confirmation before discarding it', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<HighlightHistory history={history} document={readerFixture().document} messages={messages} busy={false} onSave={onSave}/>);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('😀')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Clear'}));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Clear'}));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({kind: 'discardHighlightHistory', payload: {historyId: 'old'}})));
  confirm.mockRestore();
});
it('keeps explicit ranges and color after failure and never restores full sentences implicitly', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  render(<HighlightHistory history={history} document={readerFixture().document} messages={messages} busy={false} onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button', {name: messages.highlightRestore}));
  const save = screen.getByRole('button', {name: 'Save'});
  expect(save).toBeDisabled();
  const sentence = document.querySelector('[data-sentence-id="s1"]')!;
  fireEvent.pointerDown(sentence);
  const range = document.createRange(); range.setStart(sentence.firstChild!, 1); range.setEnd(sentence.firstChild!, 3);
  document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  fireEvent.pointerDown(save); fireEvent.click(save);
  await screen.findByRole('alert');
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({kind: 'restoreHighlight', payload: {historyId: 'old', sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 1, end: 3}], color: 'red'}}));
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument());
});
