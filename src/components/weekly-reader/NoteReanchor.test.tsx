import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {NoteReanchor} from './NoteReanchor';

const note = {id: 'note', text: 'Private note', quote: 'Original quote', sentenceIds: [], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: true, createdAt: '', updatedAt: ''};
const props = {note, document: readerFixture().document, messages: getMessages('en').weeklyReader, onComplete: vi.fn(), onCancel: vi.fn()};
function select() {
  const sentence = document.querySelector('[data-sentence-id="s1"]')!;
  fireEvent.pointerDown(sentence);
  const range = document.createRange(); range.setStart(sentence.firstChild!, 1); range.setEnd(sentence.firstChild!, 3);
  document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
  fireEvent(document, new Event('selectionchange'));
}
it('requires explicit selection, preserves input after failure and confirms only a saved operation', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({status: 'queued'});
  const onComplete = vi.fn(), onCancel = vi.fn();
  render(<NoteReanchor {...props} onSave={onSave} onComplete={onComplete} onCancel={onCancel}/>);
  const save = screen.getByRole('button', {name: 'Save'});
  expect(save).toBeDisabled();
  expect(screen.getByText(note.quote)).toBeInTheDocument();
  select(); fireEvent.pointerDown(save); fireEvent.click(save);
  await screen.findByRole('alert');
  expect(onSave).toHaveBeenCalledWith(note, [{sentenceId: 's1', start: 1, end: 3}]);
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(save);
  await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSave).toHaveBeenCalledTimes(2);
});
it('requires explicit retry and reselection after a concurrent note edit', async () => {
  const updated = {...note, version: 2, text: 'Cloud edit'};
  const onSave = vi.fn().mockResolvedValueOnce({status: 'note_conflict', note: updated}).mockResolvedValue({status: 'applied'});
  render(<NoteReanchor {...props} onSave={onSave}/>);
  select(); const save = screen.getByRole('button', {name: 'Save'}); fireEvent.pointerDown(save); fireEvent.click(save);
  await screen.findByText('Cloud edit');
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: props.messages.retry}));
  expect(save).toBeDisabled();
  select(); fireEvent.pointerDown(save); fireEvent.click(save);
  await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(updated, [{sentenceId: 's1', start: 1, end: 3}]));
});
