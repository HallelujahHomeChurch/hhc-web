import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {OfflineControl} from './OfflineControl';
const store = vi.hoisted(() => ({supportsOfflineReader: vi.fn(() => true), getOfflineIdentity: vi.fn(), readOfflineSave: vi.fn(), stageOfflineSave: vi.fn(), commitOfflineSave: vi.fn(), removeOfflineSave: vi.fn()}));
vi.mock('@/features/weekly-reader/offline-store', () => store);
vi.mock('@/lib/reader-shell', () => ({prepareOfflineReaderShell: async () => {}}));
const api = {open: vi.fn(), renew: vi.fn()};
const props = {api, value: readerFixture(), selector: {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const}, locale: 'en' as const, messages: getMessages('en').weeklyReader, onSaved: vi.fn()};
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
});
it('retains the existing save and surfaces quota failure rather than reporting success', async () => {
  store.commitOfflineSave.mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  render(<OfflineControl {...props}/>);
  fireEvent.click(await screen.findByRole('button', {name: 'Save offline'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
  expect(props.onSaved).not.toHaveBeenCalled(); expect(store.removeOfflineSave).not.toHaveBeenCalled();
});
it('hides offline controls when the browser cannot provide required storage and locking', () => {
  store.supportsOfflineReader.mockReturnValue(false);
  render(<OfflineControl {...props}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
