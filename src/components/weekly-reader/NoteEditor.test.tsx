import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {NoteEditor} from './NoteEditor';

const messages = getMessages('en').weeklyReader;
it('keeps text and selection owner open on failed storage, completes only on acknowledgement, and cancels without saving', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue({status: 'queued'});
  const onComplete = vi.fn(), onCancel = vi.fn();
  render(<NoteEditor messages={messages} quote="原句" onSave={onSave} onComplete={onComplete} onCancel={onCancel}/>);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: '保留的筆記'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox')).toHaveValue('保留的筆記');
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith('queued'));
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  expect(onCancel).toHaveBeenCalledOnce(); expect(onSave).toHaveBeenCalledTimes(2);
});
it('keeps both note versions and requires an explicit conflict choice before another save', async () => {
  const note = {id: 'note', text: 'Original', sentenceIds: ['s0'], inactiveAnchors: [], quote: 'Source', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const onSave = vi.fn().mockResolvedValueOnce({status: 'note_conflict', note: {...note, text: 'Cloud change', version: 2}}).mockResolvedValue({status: 'applied'});
  render(<NoteEditor messages={messages} note={note} quote={note.quote} onSave={onSave} onComplete={vi.fn()} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Local change'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await screen.findByText('Cloud change');
  expect(screen.getByRole('textbox')).toHaveValue('Local change');
  expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: 'Keep local'}));
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({noteId: 'note', baseVersion: 2, text: 'Local change'}));
});
it('counts Unicode characters and rejects an oversized note without losing its contents', () => {
  render(<NoteEditor messages={messages} quote="Source" onSave={vi.fn()} onComplete={vi.fn()} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: '😀'.repeat(10000)}});
  expect(screen.getByRole('button', {name: 'Save'})).not.toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'), {target: {value: '😀'.repeat(10001)}});
  expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
  expect(screen.getByRole('textbox')).toHaveValue('😀'.repeat(10001));
});
