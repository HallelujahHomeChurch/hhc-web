import {beforeEach, expect, it, vi} from 'vitest';
import {forgetOfflineAccount, prepareOfflineAccount, watchOfflineAccount} from './offline-session';
import {readReaderReturn, saveReaderReturn} from './return-state';
const store = vi.hoisted(() => ({supportsOfflineReader: vi.fn(() => true), getOfflineIdentity: vi.fn(), activateOfflineAccount: vi.fn(), clearOfflineAccount: vi.fn()}));
vi.mock('./offline-store', () => store);
beforeEach(() => {vi.clearAllMocks(); store.getOfflineIdentity.mockResolvedValue({accountId: 'old', epoch: 1}); store.activateOfflineAccount.mockResolvedValue(2); store.clearOfflineAccount.mockResolvedValue(undefined); sessionStorage.clear();});

it('purges old restoration keys on account switch, while preserving unrelated session state', async () => {
  sessionStorage.setItem('weekly-reader-position:old:doc:1', 'p1'); sessionStorage.setItem('unrelated', 'keep');
  await prepareOfflineAccount('new');
  expect(store.activateOfflineAccount).toHaveBeenCalledWith('new');
  expect(sessionStorage.getItem('weekly-reader-position:old:doc:1')).toBeNull();
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
});

it('notifies mounted readers only after the local purge succeeds', async () => {
  const changed = vi.fn(); const stop = watchOfflineAccount(changed);
  await forgetOfflineAccount('old');
  expect(changed).toHaveBeenCalledWith(null);
  changed.mockClear(); store.clearOfflineAccount.mockRejectedValueOnce(new Error('storage'));
  await expect(forgetOfflineAccount('old')).rejects.toThrow('storage');
  expect(changed).not.toHaveBeenCalled(); stop();
});

it('clears transient private drafts on account switch even without offline support', async () => {
  store.supportsOfflineReader.mockReturnValueOnce(false);
  const binding = {accountId: 'old', documentId: 'doc'};
  saveReaderReturn(binding, {revision: 1, draft: {text: 'private'}});
  await prepareOfflineAccount('new');
  expect(readReaderReturn(binding)).toBeNull();
});
