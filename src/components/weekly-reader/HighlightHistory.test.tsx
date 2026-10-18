import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {HighlightHistory} from './HighlightHistory';

const messages = getMessages('en').weeklyReader;
const history = [{id: 'old', highlight: {sentenceId: 'gone', quote: '甲😀乙', color: 'red' as const, active: false, version: 1, updatedAt: '', segments: [{start: 1, end: 2, color: 'red' as const}]}}, {id: 'consumed'}];
it('restores history with explicitly tapped mobile sentences, not native selection', async () => {
  const onSave=vi.fn().mockResolvedValue(undefined);
  render(<HighlightHistory onConfirm={vi.fn().mockResolvedValue(true)} history={history} document={readerFixture().document} messages={messages} busy={false} mobile onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button',{name:messages.highlightRestore}));
  fireEvent.click(screen.getByText('內容1。'));fireEvent.click(screen.getByRole('button',{name:'Save'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(expect.objectContaining({kind:'restoreHighlight',payload:{historyId:'old',sentenceIds:['s1'],ranges:[{sentenceId:'s1',start:0,end:4}],color:'red'}})));
});
it('renders only retained history and requires confirmation before discarding it', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<HighlightHistory onConfirm={confirm} history={history} document={readerFixture().document} messages={messages} busy={false} onSave={onSave}/>);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('😀')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Clear'}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Clear'})).toBeEnabled());
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Clear'}));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({kind: 'discardHighlightHistory', payload: {historyId: 'old'}})));

});
it('keeps explicit ranges and color after failure and never restores full sentences implicitly', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  render(<HighlightHistory onConfirm={vi.fn().mockResolvedValue(true)} history={history} document={readerFixture().document} messages={messages} busy={false} onSave={onSave}/>);
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

it('clears the caller selection after cancel and after a completed restore', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<HighlightHistory onConfirm={vi.fn().mockResolvedValue(true)} history={history} document={readerFixture().document} messages={messages} busy={false} mobile onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button', {name: messages.highlightRestore}));
  fireEvent.click(screen.getByText('內容1。'));
  expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  fireEvent.click(screen.getByRole('button', {name: messages.highlightRestore}));
  expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
  fireEvent.click(screen.getByText('內容1。'));
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await waitFor(() => expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: messages.highlightRestore}));
  expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
});

it.each(['unmount', 'busy', 'revision', 'history'] as const)('rejects a delayed discard after %s drift and prevents duplicate decisions', async drift => {
  let finish!: (accepted: boolean) => void;
  const confirm = vi.fn(() => new Promise<boolean>(resolve => {finish = resolve;})), onSave = vi.fn();
  const props = {onConfirm: confirm, onSave, history, document: readerFixture().document, messages, busy: false};
  const view = render(<HighlightHistory {...props}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Clear'})); fireEvent.click(screen.getByRole('button', {name: 'Clear'}));
  expect(confirm).toHaveBeenCalledOnce();
  if (drift === 'unmount') view.unmount();
  else view.rerender(<HighlightHistory {...props} busy={drift === 'busy'} document={drift === 'revision' ? {...props.document, revision: 2} : props.document} history={drift === 'history' ? [] : history}/>);
  await act(async () => finish(true)); expect(onSave).not.toHaveBeenCalled();
});
