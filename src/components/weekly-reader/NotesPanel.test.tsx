import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {NotesPanel} from './NotesPanel';

it('lists multiple private notes, keeps removed quotes, hides tombstones and jumps only to active anchors', () => {
  const onJump = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn();
  const note = {id: 'one', text: '第一則', sentenceIds: ['s0'], inactiveAnchors: [], quote: '原文', version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  render(<NotesPanel messages={getMessages('en').weeklyReader} notes={[note, {...note, id: 'two', text: '第二則', sentenceIds: [], inactiveAnchors: [{sentenceId: 'old', quote: '原文', pageId: 'p0', componentId: 'c0'}]}, {...note, id: 'deleted', text: '不可見', deleted: true}]} onJump={onJump} onEdit={onEdit} onDelete={onDelete}/>);
  expect(screen.getByText('第一則')).toBeInTheDocument(); expect(screen.getByText('第二則')).toBeInTheDocument();
  expect(screen.queryByText('不可見')).not.toBeInTheDocument();
  expect(screen.getByText('Original content removed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Go to source'})); expect(onJump).toHaveBeenCalledWith('s0');
  fireEvent.click(screen.getAllByRole('button', {name: 'Edit'})[0]); expect(onEdit).toHaveBeenCalledWith(note);
});
