import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ReaderSearch} from './ReaderSearch';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
afterEach(cleanup);
it('search header keeps the close control with input outside the scrolling results', () => {
  const m = getMessages('en').weeklyReader;
  render(<ReaderSearch document={readerFixture().document} onJump={() => {}} messages={m} closeControl={<button>Back to reader</button>}/>);
  const header = screen.getByRole('button', {name: 'Back to reader'}).closest('.reader-search-header');
  expect(header).toContainElement(screen.getByRole('searchbox'));
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容'}}); fireEvent.submit(screen.getByRole('search'));
  expect(header).not.toContainElement(screen.getByRole('list'));
  expect(screen.getByRole('list').closest('.reader-search-results')).toBeInTheDocument();
});
it('mobile contents use approved labels without changing chapter ids', () => {
  const m = getMessages('zh-Hant').weeklyReader;
  expect([m.chapterCover, m.chapterBody, m.chapterWorship, m.chapterBack, m.originalPages]).toEqual(['封面', '信息回應', '小組詩歌', '封底', 'PDF 頁面']);
});
it('submits explicitly and lists all matches before navigating', () => {
  const m = getMessages('en').weeklyReader, onJump = vi.fn();
  render(<ReaderSearch document={readerFixture().document} onJump={onJump} messages={m}/>);
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容'}});
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  fireEvent.submit(screen.getByRole('search'));
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
  expect(onJump).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: /內容2/}));
  expect(onJump).toHaveBeenCalledWith('s2');
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'not in the document'}});
  fireEvent.submit(screen.getByRole('search'));
  expect(screen.getByRole('status')).toHaveTextContent(m.noResults);
  fireEvent.click(screen.getByRole('button', {name: m.clearSearch}));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.queryByText(m.noResults)).not.toBeInTheDocument();
});
