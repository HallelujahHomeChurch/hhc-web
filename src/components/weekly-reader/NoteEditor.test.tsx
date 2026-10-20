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

it('does not silently recreate an edited note after the cloud note was deleted', async () => {
  const note = {id: 'deleted-note', text: 'Original', sentenceIds: ['s0'], inactiveAnchors: [], quote: 'Source', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const onSave = vi.fn().mockResolvedValue({status: 'note_conflict', note: {...note, text: '', version: 2, deleted: true}});
  const onComplete = vi.fn();
  render(<NoteEditor messages={messages} note={note} quote={note.quote} onSave={onSave} onComplete={onComplete} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Retain my local text'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await screen.findByText(messages.noteDeleted);
  expect(screen.getByRole('textbox')).toHaveValue('Retain my local text');
  expect(screen.queryByRole('button', {name: messages.noteLocal})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: messages.noteManual})).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Still retain local text'}});
  fireEvent.submit(screen.getByRole('textbox').closest('form')!);
  expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
  expect(onSave).toHaveBeenCalledOnce();
  expect(onComplete).not.toHaveBeenCalled();
});

it.each(['en', 'ja', 'ko', 'zh-Hans', 'zh-Hant'] as const)('keeps the character limit distinct from list counts in %s', locale => {
  render(<NoteEditor messages={getMessages(locale).weeklyReader} quote="Source" onSave={vi.fn()} onComplete={vi.fn()} onCancel={vi.fn()}/>);
  fireEvent.change(screen.getByRole('textbox'), {target: {value: '😀abc'}});
  expect(screen.getByText(/^4 \/ 10,000/)).toBeInTheDocument();
});

it('reveals the focused editor inside its resized scroll area without moving focus', () => {
  let resized!: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {constructor(callback: ResizeObserverCallback) {resized = callback;} observe() {} disconnect = disconnect;});
  const {unmount} = render(<NoteEditor messages={messages} quote="Source" onSave={vi.fn()} onComplete={vi.fn()} onCancel={vi.fn()}/>);
  const input = screen.getByRole('textbox'), body = input.parentElement!;
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 150, 350, 164));
  const bounds = vi.spyOn(input, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 228, 350, 144));
  resized([], {} as ResizeObserver); expect(body.scrollTop).toBe(58); expect(input).toHaveFocus();
  screen.getByRole('button', {name: messages.noteCancel}).focus();
  bounds.mockReturnValue(new DOMRect(0, 100, 350, 144));
  resized([], {} as ResizeObserver); expect(body.scrollTop).toBe(58);
  unmount(); expect(disconnect).toHaveBeenCalledOnce(); vi.unstubAllGlobals();
});
