import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {OfflineControl} from './OfflineControl';
const store = vi.hoisted(() => ({supportsOfflineReader: vi.fn(() => true), getOfflineIdentity: vi.fn(), readOfflineSave: vi.fn(), stageOfflineSave: vi.fn(), commitOfflineSave: vi.fn(), removeOfflineSave: vi.fn(), hasPendingReaderWrites: vi.fn().mockResolvedValue(false)}));
vi.mock('@/features/weekly-reader/offline-store', () => store);
vi.mock('@/lib/reader-shell', () => ({prepareOfflineReaderShell: async () => {}}));
const api = {open: vi.fn(), renew: vi.fn()};
const props = {api, value: readerFixture(), selector: {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const}, locale: 'en' as const, messages: getMessages('en').weeklyReader, onSaved: vi.fn(), onFailure: vi.fn()};
beforeEach(() => {vi.stubGlobal('navigator', {serviceWorker: {}});});
afterEach(() => {vi.unstubAllGlobals();});
beforeEach(() => {vi.clearAllMocks(); store.supportsOfflineReader.mockReturnValue(true); store.getOfflineIdentity.mockResolvedValue({accountId: 'account-a', epoch: 1}); store.readOfflineSave.mockResolvedValue(null); store.stageOfflineSave.mockResolvedValue({size: 100, value: readerFixture()}); store.commitOfflineSave.mockResolvedValue(undefined); api.renew.mockResolvedValue(readerFixture());});
it('revalidates and stages resources before the atomic commit, and keeps failures visible', async () => {
  render(<OfflineControl {...props}/>);
  fireEvent.click(await screen.findByRole('button', {name: 'Save offline'}));
  await waitFor(() => expect(store.commitOfflineSave).toHaveBeenCalled());
  expect(api.renew.mock.invocationCallOrder[0]).toBeLessThan(store.stageOfflineSave.mock.invocationCallOrder[0]);
  expect(store.stageOfflineSave.mock.invocationCallOrder[0]).toBeLessThan(store.commitOfflineSave.mock.invocationCallOrder[0]);
  expect(props.onSaved).toHaveBeenCalledWith(readerFixture());
  expect(await screen.findByRole('button', {name: 'Saved offline'})).toBeDisabled();
});
it('shows a disabled loading icon until saving completes', async () => {
  let finish!: (value: ReturnType<typeof readerFixture>) => void;
  api.renew.mockReturnValueOnce(new Promise(resolve => {finish = resolve;}));
  render(<OfflineControl {...props}/>);
  fireEvent.click(await screen.findByRole('button', {name: 'Save offline'}));
  const loading = await screen.findByRole('button', {name: props.messages.savingOffline});
  expect(loading).toBeDisabled();
  expect(loading.closest('.reader-offline-control')).toHaveAttribute('aria-busy', 'true');
  expect(loading.querySelector('.reader-saving-spinner')).not.toBeNull();
  finish(readerFixture());
  expect(await screen.findByRole('button', {name: 'Saved offline'})).toBeDisabled();
});
it('allows saving again when the existing offline authorization has expired', async () => {
  store.readOfflineSave.mockResolvedValue({status: 'expired', save: {size: 100, value: readerFixture()}});
  render(<OfflineControl {...props}/>);
  expect(await screen.findByRole('button', {name: 'Save offline'})).toBeEnabled();
});
it('retains the existing save and surfaces quota failure rather than reporting success', async () => {
  store.commitOfflineSave.mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  render(<OfflineControl {...props}/>);
  fireEvent.click(await screen.findByRole('button', {name: 'Save offline'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
  expect(props.onSaved).not.toHaveBeenCalled(); expect(store.removeOfflineSave).not.toHaveBeenCalled();
});
it('routes renewal failures through the same authorization boundary as reading', async () => {
  const denied = new Error('owner denial');
  api.renew.mockRejectedValueOnce(denied);
  render(<OfflineControl {...props}/>);
  fireEvent.click(await screen.findByRole('button', {name: 'Save offline'}));
  await screen.findByRole('alert');
  expect(props.onFailure).toHaveBeenCalledWith(denied);
  expect(store.commitOfflineSave).not.toHaveBeenCalled();
});
it('hides offline controls when the browser cannot provide required storage and locking', () => {
  store.supportsOfflineReader.mockReturnValue(false);
  render(<OfflineControl {...props}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('shows a disabled saved icon for an available current revision', async () => {
  store.readOfflineSave.mockResolvedValue({status: 'available', save: {size: 100, value: readerFixture()}});
  render(<OfflineControl {...props}/>);
  expect(await screen.findByRole('button', {name: 'Saved offline'})).toBeDisabled();
  expect(store.removeOfflineSave).not.toHaveBeenCalled();
});
