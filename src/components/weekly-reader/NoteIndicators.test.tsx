import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createRef} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {NoteIndicators} from './NoteIndicators';
import {renderedTextRanges} from '@/features/weekly-reader/text-range';

afterEach(cleanup);
it('mobile note targets occupy their row immediately, without a zero-height frame', () => {
  const root = createRef<HTMLDivElement>();
  const notes = [{id: 'a', sentenceIds: ['s1'], deleted: false}] as BulletinReaderNote[];
  render(<div ref={root}><p data-block-id="p"><span data-sentence-id="s1">Text</span></p><NoteIndicators root={root} notes={notes} layoutKey="mobile" label="Notes" onOpen={() => {}} mobile/></div>);
  expect(screen.getByRole('button', {name: 'Notes (1)'})).toBeInTheDocument();
});
it('mobile progress refreshes retain existing rows and focused targets, but deleted notes remove them', async () => {
  const root = createRef<HTMLDivElement>();
  const notes = [{id: 'a', sentenceIds: ['s1'], deleted: false}] as BulletinReaderNote[];
  function Content({items, layoutKey}: {items: BulletinReaderNote[]; layoutKey: string}) {return <div ref={root}><p data-block-id="p"><span data-sentence-id="s1">Text</span></p><NoteIndicators root={root} notes={items} layoutKey={layoutKey} label="Notes" onOpen={() => {}} mobile/></div>;}
  const {container, rerender} = render(<Content items={notes} layoutKey="p1:scale1"/>);
  const button = await screen.findByRole('button', {name: 'Notes (1)'});
  const host = container.querySelector('.reader-note-row'); button.focus();
  rerender(<Content items={notes.map(note => ({...note}))} layoutKey="p2:scale2"/>);
  expect(container.querySelector('.reader-note-row')).toBe(host);
  expect(screen.getByRole('button', {name: 'Notes (1)'})).toBe(button);
  expect(document.activeElement).toBe(button);
  rerender(<Content items={notes.map(note => ({...note, deleted: true}))} layoutKey="p2:scale2"/>);
  expect(container.querySelector('.reader-note-row')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});
it('mobile heading notes stay after the whole flex heading, not between title and speaker', async () => {
  const root = createRef<HTMLDivElement>();
  const notes = [{id: 'heading', sentenceIds: ['title', 'speaker', 'song'], deleted: false}] as BulletinReaderNote[];
  const {container} = render(<div ref={root}><section data-component-id="c"><div className="hhc-ebook-body-heading" style={{display: 'flex'}}><h2 data-block-id="title"><span data-sentence-id="title">Title</span></h2><span data-component-id="speaker"><span data-sentence-id="speaker">～ Speaker</span></span></div><div className="hhc-ebook-song-heading" style={{display: 'flex'}}><h3><span data-sentence-id="song">Song</span></h3><span>Source</span></div></section><NoteIndicators root={root} notes={notes} layoutKey="mobile" label="Notes" onOpen={() => {}} mobile/></div>);
  await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(2));
  for (const group of container.querySelectorAll('.hhc-ebook-body-heading,.hhc-ebook-song-heading')) {
    expect(group.querySelector('.reader-note-row')).toBeNull();
    expect(group.nextElementSibling).toHaveClass('reader-note-row');
  }
  expect(container.querySelector('[data-sentence-id="speaker"]')).toHaveTextContent('～ Speaker');
});
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
