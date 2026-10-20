import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {NotesPanel} from './NotesPanel';

it('lists multiple private notes, keeps removed quotes, hides tombstones and jumps only to active anchors', () => {
  const onJump = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn(), onReanchor = vi.fn();
  const note = {id: 'one', text: '第一則', sentenceIds: ['s0'], inactiveAnchors: [], quote: '原文', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  render(<NotesPanel messages={getMessages('en').weeklyReader} notes={[note, {...note, id: 'two', text: '第二則', sentenceIds: [], inactiveAnchors: [{sentenceId: 'old', quote: '原文', pageId: 'p0', componentId: 'c0'}]}, {...note, id: 'deleted', text: '不可見', deleted: true}]} onJump={onJump} onEdit={onEdit} onDelete={onDelete} onReanchor={onReanchor}/>);
  expect(screen.getByText('第一則')).toBeInTheDocument(); expect(screen.getByText('第二則')).toBeInTheDocument();
  expect(screen.queryByText('不可見')).not.toBeInTheDocument();
  expect(screen.getByText('Original content removed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Go to source'})); expect(onJump).toHaveBeenCalledWith('s0');
  fireEvent.click(screen.getAllByRole('button', {name: 'Edit'})[0]); expect(onEdit).toHaveBeenCalledWith(note);
  fireEvent.click(screen.getByRole('button', {name: 'Relink note'})); expect(onReanchor).toHaveBeenCalledWith(expect.objectContaining({id: 'two'}));
});

it.each([false, true])('keeps focus in the list after deletion (adjacent=%s)', async adjacent => {
  const messages = getMessages('en').weeklyReader;
  const note = {id: 'one', text: 'First', sentenceIds: ['s0'], inactiveAnchors: [], quote: 'Source', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const next = {...note, id: 'two', text: 'Next'};
  const props = {messages, onJump: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onReanchor: vi.fn()};
  const view = render(<NotesPanel {...props} notes={adjacent ? [note, next] : [note]}/>);
  const button = screen.getAllByRole('button', {name: messages.noteDelete})[0]; button.focus(); fireEvent.click(button);
  view.rerender(<NotesPanel {...props} notes={adjacent ? [next] : []}/>);
  await waitFor(() => expect(adjacent ? screen.getByRole('button', {name: messages.noteJump}) : screen.getByRole('heading', {name: messages.notesTab})).toHaveFocus());
});
it('jumps to the first still-active exact range rather than the sentence start', () => {
  const onJump = vi.fn();
  const note = {id: 'partial', text: 'My note', sentenceIds: ['s0'], ranges: [{sentenceId: 'removed', start: 1, end: 3, quote: 'old'}, {sentenceId: 's0', start: 7, end: 9, quote: '命中'}], inactiveAnchors: [], quote: '命中', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  render(<NotesPanel messages={getMessages('en').weeklyReader} notes={[note]} onJump={onJump} onEdit={vi.fn()} onDelete={vi.fn()} onReanchor={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Go to source'}));
  expect(onJump).toHaveBeenCalledWith('s0', 7);
});
