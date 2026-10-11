import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createRef} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {NoteIndicators} from './NoteIndicators';
import {renderedTextRanges} from '@/features/weekly-reader/text-range';

afterEach(cleanup);
it('mobile notes share a paragraph row without changing sentence text or exact ranges', async () => {
  const root = createRef<HTMLDivElement>(), onOpen = vi.fn();
  const notes = [{id: 'a', sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 1, end: 3}], deleted: false}, {id: 'b', sentenceIds: ['s2'], deleted: false}] as BulletinReaderNote[];
  const {container} = render(<div ref={root}><section data-component-id="c"><p data-block-id="p"><span data-sentence-id="s1" data-fragment-start="0" data-fragment-end="4">A😀BC</span><span data-sentence-id="s2" data-fragment-start="0" data-fragment-end="3">DEF</span></p></section><NoteIndicators root={root} notes={notes} layoutKey="mobile" label="Notes" onOpen={onOpen} mobile/></div>);
  const sentence = container.querySelector('[data-sentence-id="s1"]')!;
  const ranges = [{sentenceId: 's1', start: 1, end: 3}];
  const quoteBefore = renderedTextRanges(root.current!, ranges[0]).map(range => range.toString());
  await waitFor(() => expect(screen.getByRole('button', {name: 'Notes (2)'})).toBeInTheDocument());
  const button = screen.getByRole('button', {name: 'Notes (2)'});
  expect(button.closest('[data-sentence-id]')).toBeNull();
  expect(button.closest('.reader-note-row')?.previousElementSibling).toBe(container.querySelector('p'));
  expect(sentence.textContent).toBe('A😀BC');
  expect(renderedTextRanges(root.current!, ranges[0]).map(range => range.toString())).toEqual(quoteBefore);
  expect(notes[0].ranges).toEqual(ranges);
  fireEvent.click(button); expect(onOpen).toHaveBeenCalledWith(['a', 'b'], button);
});
it('heading and cross-paragraph notes have valid hosts and switching to desktop removes them', async () => {
  const root = createRef<HTMLDivElement>();
  const notes = [{id: 'cross', sentenceIds: ['s1', 's2'], deleted: false}] as BulletinReaderNote[];
  function Content({mobile}: {mobile: boolean}) {return <div ref={root}><section data-component-id="c"><h2 data-block-id="heading"><span data-sentence-id="s1">Heading</span></h2><p data-block-id="p"><span data-sentence-id="s2">Paragraph</span></p></section><NoteIndicators root={root} notes={notes} layoutKey={String(mobile)} label="Notes" onOpen={() => {}} mobile={mobile}/></div>;}
  const {container, rerender, unmount} = render(<Content mobile/>);
  await waitFor(() => expect(container.querySelectorAll('.reader-note-row')).toHaveLength(2));
  await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(2));
  for (const button of screen.getAllByRole('button')) expect(button.closest('[data-sentence-id]')).toBeNull();
  rerender(<Content mobile={false}/>);
  await waitFor(() => expect(container.querySelectorAll('.reader-note-row')).toHaveLength(0));
  await waitFor(() => expect(container.querySelectorAll('.reader-note-indicator')).toHaveLength(1));
  rerender(<Content mobile/>); await waitFor(() => expect(container.querySelectorAll('.reader-note-row')).toHaveLength(2));
  unmount(); expect(document.querySelector('.reader-note-row')).toBeNull();
});

it('groups nearby note anchors into one accessible target and excludes deleted notes', async () => {
  const root = createRef<HTMLDivElement>();
  const onOpen = vi.fn();
  const notes = [{id: 'a', sentenceIds: ['s1'], deleted: false}, {id: 'b', sentenceIds: ['s2'], deleted: false}, {id: 'deleted', sentenceIds: ['s1'], deleted: true}] as BulletinReaderNote[];
  render(<div ref={root}><span data-sentence-id="s1">First</span><span data-sentence-id="s2">Second</span><NoteIndicators root={root} notes={notes} layoutKey="p1" label="Notes" onOpen={onOpen}/></div>);
  await waitFor(() => expect(screen.getAllByRole('button', {name: 'Notes (2)'})).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', {name: 'Notes (2)'}));
  expect(onOpen).toHaveBeenCalledWith(['a', 'b'], screen.getByRole('button', {name: 'Notes (2)'}));
});
it('anchors a cross-page sentence to its first fragment instead of silently moving the note to the last page', async () => {
  const root = createRef<HTMLDivElement>();
  const notes = [{id: 'a', sentenceIds: ['s1'], deleted: false}] as BulletinReaderNote[];
  const {container} = render(<div ref={root}><span data-sentence-id="s1">First page</span><span data-sentence-id="s1">Next page</span><NoteIndicators root={root} notes={notes} layoutKey="continuous" label="Notes" onOpen={() => {}}/></div>);
  const anchors = container.querySelectorAll('span');
  vi.spyOn(anchors[0], 'getBoundingClientRect').mockReturnValue({top: 40} as DOMRect);
  vi.spyOn(anchors[1], 'getBoundingClientRect').mockReturnValue({top: 900} as DOMRect);
  await waitFor(() => expect(screen.getByRole('button', {name: 'Notes (1)'})).toHaveStyle({top: '40px'}));
});
