import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createRef} from 'react';
import {expect, it, vi} from 'vitest';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {NoteIndicators} from './NoteIndicators';

it('groups nearby note anchors into one accessible target and excludes deleted notes', async () => {
  const root = createRef<HTMLDivElement>();
  const onOpen = vi.fn();
  const notes = [{id: 'a', sentenceIds: ['s1'], deleted: false}, {id: 'b', sentenceIds: ['s2'], deleted: false}, {id: 'deleted', sentenceIds: ['s1'], deleted: true}] as BulletinReaderNote[];
  render(<div ref={root}><span data-sentence-id="s1">First</span><span data-sentence-id="s2">Second</span><NoteIndicators root={root} notes={notes} layoutKey="p1" label="Notes" onOpen={onOpen}/></div>);
  await waitFor(() => expect(screen.getAllByRole('button', {name: 'Notes (2)'})).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', {name: 'Notes (2)'}));
  expect(onOpen).toHaveBeenCalledWith(['a', 'b']);
});
