import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
import {OfflineContentPage} from './OfflineContentPage';
const store = vi.hoisted(() => ({supportsOfflineReader: () => true, getOfflineIdentity: vi.fn(), listOfflineSaves: vi.fn(), readOfflineSave: vi.fn(), removeOfflineSave: vi.fn(), readOfflineRemovalSnapshot: vi.fn()}));
const identity = vi.hoisted(() => ({accountId: null as string | null, changed: () => {}}));
vi.mock('@/features/weekly-reader/offline-store', () => store);
vi.mock('@/features/weekly-reader/offline-session', () => ({watchOfflineAccount: (changed: () => void) => {identity.changed = changed; return () => {};}}));
vi.mock('@/components/layout/AccountControl', () => ({useAccountIdentity: () => identity.accountId}));
const m = getMessages('en').weeklyReader;
const save = {selector: {accountId: 'account-a', issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant'}, documentId: readerFixture().access.documentId, revision: 1, offlineValidUntil: readerFixture().access.offlineValidUntil, size: 1024};
const snapshot = {accountId: 'account-a', documentId: save.documentId, revision: 1, pending: false, instanceId: 'instance'};
beforeEach(() => {
  vi.resetAllMocks(); identity.accountId = null;
  vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true');
  store.getOfflineIdentity.mockResolvedValue({accountId: 'account-a', epoch: 1});
  store.listOfflineSaves.mockResolvedValue([save]); store.readOfflineSave.mockResolvedValue({status: 'expired'});
  store.readOfflineRemovalSnapshot.mockResolvedValue(snapshot); store.removeOfflineSave.mockResolvedValue(undefined);
});
it('lists locked downloads without private text and removes only after the house dialog accepts the exact snapshot', async () => {
  render(<OfflineContentPage locale="en" messages={m}/>);
  const link = await screen.findByRole('link', {name: /1739 · General bulletin/});
  expect(link).toHaveAttribute('href', '/en/literature-ministry/1739/read/general/zh-Hant');
  expect(screen.getByText(m.offlineLocked)).toBeInTheDocument();
  expect(screen.queryByText('Private weekly')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: m.removeOffline}));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.closest('.hhc-modal-overlay')).toHaveAttribute('data-reader-exit');
  expect(dialog).toHaveTextContent(m.offlineRemoveConfirm); expect(store.removeOfflineSave).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', {name: m.removeOffline}));
  await waitFor(() => expect(store.removeOfflineSave).toHaveBeenCalledExactlyOnceWith(save.selector, snapshot));
});
it('shows the unsynced warning and cancels without removing', async () => {
  store.readOfflineRemovalSnapshot.mockResolvedValue({...snapshot, pending: true});
  render(<OfflineContentPage locale="en" messages={m}/>);
  fireEvent.click(await screen.findByRole('button', {name: m.removeOffline}));
  const dialog = await screen.findByRole('alertdialog'); expect(dialog).toHaveTextContent(m.unsyncedWarning);
  expect(store.readOfflineRemovalSnapshot).toHaveBeenCalledWith(save.selector);
  fireEvent.click(within(dialog).getByRole('button', {name: m.noteCancel}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(store.removeOfflineSave).not.toHaveBeenCalled();
});
it('retains the download and reloads after a stale decision or a storage failure', async () => {
  store.removeOfflineSave.mockRejectedValue(new Error('offline_replica_changed'));
  render(<OfflineContentPage locale="en" messages={m}/>);
  fireEvent.click(await screen.findByRole('button', {name: m.removeOffline}));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', {name: m.removeOffline}));
  expect(await screen.findByRole('alert')).toHaveTextContent(m.offlineError);
  expect(screen.getByRole('link', {name: /1739 · General bulletin/})).toBeInTheDocument();
  await waitFor(() => expect(store.listOfflineSaves).toHaveBeenCalledTimes(2));
});
it.each(['account', 'owner', 'unmount'] as const)('invalidates a pending snapshot on %s change', async change => {
  let finish!: (value: unknown) => void;
  store.readOfflineRemovalSnapshot.mockReturnValue(new Promise(resolve => {finish = resolve;}));
  identity.accountId = 'account-a';
  const view = render(<OfflineContentPage locale="en" messages={m}/>);
  fireEvent.click(await screen.findByRole('button', {name: m.removeOffline}));
  fireEvent.click(screen.getByRole('button', {name: m.removeOffline}));
  expect(store.readOfflineRemovalSnapshot).toHaveBeenCalledOnce();
  if (change === 'account') {identity.accountId = 'account-b'; view.rerender(<OfflineContentPage locale="en" messages={m}/>);}
  else if (change === 'owner') act(() => identity.changed());
  else view.unmount();
  await act(async () => finish(snapshot));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(); expect(store.removeOfflineSave).not.toHaveBeenCalled();
});
it('hides previous-account downloads immediately and discards their pending listing', async () => {
  let finish!: (value: unknown[]) => void;
  store.listOfflineSaves.mockReturnValueOnce(new Promise(resolve => {finish = resolve;}));
  identity.accountId = 'account-a';
  const view = render(<OfflineContentPage locale="en" messages={m}/>);
  await waitFor(() => expect(finish).toBeDefined());
  identity.accountId = 'account-b'; view.rerender(<OfflineContentPage locale="en" messages={m}/>);
  await act(async () => finish([save]));
  expect(screen.queryByRole('link', {name: /1739 · General bulletin/})).not.toBeInTheDocument();
});

it('discards a pending listing on offline-owner notification even before auth changes', async () => {
  let finish!: (value: unknown[]) => void;
  store.listOfflineSaves.mockReturnValueOnce(new Promise(resolve => {finish = resolve;}));
  render(<OfflineContentPage locale="en" messages={m}/>);
  await waitFor(() => expect(finish).toBeDefined());
  store.getOfflineIdentity.mockResolvedValue({accountId: null, epoch: 2});
  act(() => identity.changed());
  await act(async () => finish([save]));
  expect(screen.queryByRole('link', {name: /1739 · General bulletin/})).not.toBeInTheDocument();
});
