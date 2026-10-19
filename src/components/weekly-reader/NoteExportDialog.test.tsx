import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {NoteExportDialog} from './NoteExportDialog';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
const m = getMessages('en').weeklyReader;
const note = {id: 'note-a', text: 'Own text', quote: 'No quote', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
const revoke = vi.fn(), click = vi.fn();
function props() {return {messages: m, document: readerFixture().document, locale: 'en' as const, issueNumber: 1739, visibleIds: [note.id], total: 2, theme: 'light' as const, prepare: vi.fn().mockResolvedValue({notes: [note], local: true, pendingNoteIds: new Set([note.id]), validate: async (commit: () => void) => commit()}), current: () => true, onClose: vi.fn()};}
beforeEach(() => {vi.stubGlobal('URL', Object.assign(URL, {createObjectURL: vi.fn(() => 'blob:private-notes'), revokeObjectURL: revoke})); Object.defineProperty(navigator, 'userActivation', {configurable: true, value: {isActive: true}}); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click); vi.clearAllMocks();});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});
it('prepares an explicit filtered snapshot, hands off only after a second action, and cleans URLs on cancel', async () => {
  const p = props(), {unmount} = render(<NoteExportDialog {...p}/>);
  expect(p.prepare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(m.exportFiltered.replace('{count}', '1')));
  fireEvent.click(screen.getByRole('button', {name: m.exportPrepare}));
  await screen.findByText(m.exportReady.replace('{count}', '1'), {exact: false});
  expect(p.prepare).toHaveBeenCalledWith([note.id]); expect(click).not.toHaveBeenCalled();
  unmount(); expect(revoke).toHaveBeenCalledWith('blob:private-notes');
});
it('retains the prepared file when activation expires, with no automatic retry or success claim', async () => {
  const p = props(); render(<NoteExportDialog {...p}/>);
  fireEvent.click(screen.getByRole('button', {name: m.exportPrepare})); await screen.findByRole('button', {name: m.exportDownload});
  Object.defineProperty(navigator, 'userActivation', {configurable: true, value: {isActive: false}});
  fireEvent.click(screen.getByRole('button', {name: m.exportDownload})); await screen.findByText(m.exportActivation);
  expect(click).not.toHaveBeenCalled(); expect(revoke).not.toHaveBeenCalled(); expect(screen.queryByText(m.exportHanded)).not.toBeInTheDocument();
  Object.defineProperty(navigator, 'userActivation', {configurable: true, value: {isActive: true}});
  fireEvent.click(screen.getByRole('button', {name: m.exportDownload})); await screen.findByText(m.exportHanded);
  expect(click).toHaveBeenCalledOnce(); expect(revoke).not.toHaveBeenCalled();
});
it('does not create a late Blob URL after unmount, or claim success after a stale snapshot', async () => {
  const p = props(); let resolve!: (value: Awaited<ReturnType<typeof p.prepare>>) => void;
  p.prepare.mockImplementationOnce(() => new Promise(finish => {resolve = finish;}));
  const {unmount} = render(<NoteExportDialog {...p}/>);
  fireEvent.click(screen.getByRole('button', {name: m.exportPrepare})); unmount();
  resolve({notes: [note], pendingNoteIds: new Set(), local: false, validate: vi.fn()});
  await waitFor(() => expect(URL.createObjectURL).not.toHaveBeenCalled());
});
it('checks live qualification again after the final async durable revalidation', async () => {
  const p = props(); let allowed = true;
  p.current = () => allowed;
  p.prepare.mockResolvedValueOnce({notes: [note], pendingNoteIds: new Set(), local: false, validate: async (commit: () => void) => {await Promise.resolve(); allowed = false; commit();}});
  render(<NoteExportDialog {...p}/>);
  fireEvent.click(screen.getByRole('button', {name: m.exportPrepare})); await screen.findByRole('button', {name: m.exportDownload});
  fireEvent.click(screen.getByRole('button', {name: m.exportDownload})); await screen.findByText(m.exportChanged);
  expect(click).not.toHaveBeenCalled(); expect(screen.queryByText(m.exportHanded)).not.toBeInTheDocument();
});
