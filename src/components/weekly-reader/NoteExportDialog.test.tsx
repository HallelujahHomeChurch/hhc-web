import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {NoteExportDialog} from './NoteExportDialog';
import {getMessages} from '@/i18n/messages';
const builder = vi.hoisted(() => ({build: vi.fn()}));
vi.mock('@/features/weekly-reader/note-export', () => ({buildNoteExport: (...args: unknown[]) => builder.build(...args)}));
const file = {buffer: new ArrayBuffer(4), bytes: 4, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: 'hhc-notes-1739.docx', missingQuotes: 0};
const m = getMessages('en').weeklyReader;
const note = {id: 'note-a', text: 'Own text', quote: 'No quote', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
const revoke = vi.fn(), click = vi.fn();
function props() {return {messages: m, locale: 'en' as const, issueNumber: 1739, visibleIds: [note.id], total: 2, theme: 'light' as const, prepare: vi.fn().mockResolvedValue({notes: [note], local: true, pendingNoteIds: new Set([note.id]), validate: async (commit: () => void) => commit()}), current: () => true, onClose: vi.fn()};}
beforeEach(() => {vi.stubGlobal('URL', Object.assign(URL, {createObjectURL: vi.fn(() => 'blob:private-notes'), revokeObjectURL: revoke})); Object.defineProperty(navigator, 'userActivation', {configurable: true, value: {isActive: true}}); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click); vi.clearAllMocks(); builder.build.mockReset().mockResolvedValue(file);});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});
it('prepares an explicit filtered snapshot, hands off only after a second action, and cleans URLs on cancel', async () => {
  const p = props(), {unmount} = render(<NoteExportDialog {...p}/>);
  expect(p.prepare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(m.exportFiltered.replace('{count}', '1')));
  fireEvent.click(screen.getByRole('button', {name: m.exportPrepare}));
  await screen.findByText(m.exportReady.replace('{count}', '1'), {exact: false});
  expect(p.prepare).toHaveBeenCalledWith([note.id]); expect((vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).type).toBe(file.mimeType); expect(click).not.toHaveBeenCalled();
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

it('does not publish a file after the lazy Word builder finishes for a closed or revoked reader', async () => {
  const p=props();let finish!: (value: typeof file) => void;
  builder.build.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const {unmount}=render(<NoteExportDialog {...p}/>);
  fireEvent.click(screen.getByRole('button',{name:m.exportPrepare}));
  await waitFor(()=>expect(builder.build).toHaveBeenCalledOnce());unmount();
  await act(async()=>finish(file));expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('rechecks live ownership after asynchronous Word generation and explains a missing saved quote', async () => {
  const p=props();let allowed=true;p.current=()=>allowed;
  builder.build.mockImplementationOnce(async()=>{allowed=false;return file;});
  const {unmount}=render(<NoteExportDialog {...p}/>);fireEvent.click(screen.getByRole('button',{name:m.exportPrepare}));
  await screen.findByRole('alert');expect(URL.createObjectURL).not.toHaveBeenCalled();unmount();
  builder.build.mockResolvedValueOnce({...file,missingQuotes:1});render(<NoteExportDialog {...props()}/>);
  fireEvent.click(screen.getByRole('button',{name:m.exportPrepare}));await screen.findByText(m.exportMissingQuote.replace('{count}','1'));
  expect(within(screen.getByRole('status')).getByText(m.exportMissingQuote.replace('{count}','1'))).toBeInTheDocument();
});

it('keeps an actionable whole-export limit error in the export dialog',async()=>{
 const p=props();p.prepare.mockRejectedValueOnce(new Error('export_limit'));
 render(<NoteExportDialog {...p}/>);fireEvent.click(screen.getByRole('button',{name:m.exportPrepare}));
 expect(await screen.findByRole('alert')).toHaveTextContent(m.exportLimit);expect(builder.build).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
