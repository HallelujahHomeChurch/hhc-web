import {activateOfflineAccount, clearOfflineAccount, getOfflineIdentity, supportsOfflineReader} from './offline-store';
import {clearReaderReturns} from './return-state';

const eventName = 'hhc:weekly-reader-account';
function clearPositions(accountId: string) {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(`weekly-reader-position:${accountId}:`)) sessionStorage.removeItem(key);
  } catch { /* Session restoration is optional. */ }
}
function notify(accountId: string | null) {
  window.dispatchEvent(new CustomEvent(eventName, {detail: {accountId}}));
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(eventName);
  channel.postMessage({accountId}); channel.close();
}
export async function prepareOfflineAccount(accountId: string) {
	clearReaderReturns(accountId);
  if (!supportsOfflineReader()) return;
  const previous = await getOfflineIdentity();
  const epoch = await activateOfflineAccount(accountId);
  if (previous.accountId !== accountId) {
    if (previous.accountId) clearPositions(previous.accountId);
    notify(accountId);
  }
  return epoch;
}
export async function forgetOfflineAccount(accountId: string) {
  await clearOfflineAccount(accountId);
  clearReaderReturns();
  clearPositions(accountId);
  notify(null);
}
export function watchOfflineAccount(onChange: (accountId: string | null) => void, remoteOnly = false) {
  const receive = (data: unknown) => {
    if (!data || typeof data !== 'object' || !('accountId' in data) || data.accountId !== null && typeof data.accountId !== 'string') return;
    clearReaderReturns(data.accountId ?? undefined);
    // SessionStorage is per-tab, unlike IndexedDB: purge its restoration hints here too.
    try {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('weekly-reader-position:') && (!data.accountId || !key.startsWith(`weekly-reader-position:${data.accountId}:`))) sessionStorage.removeItem(key);
    } catch { /* Optional restoration. */ }
    onChange(data.accountId);
  };
  const local = (event: Event) => receive((event as CustomEvent).detail);
  if (!remoteOnly) window.addEventListener(eventName, local);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(eventName);
  if (channel) channel.onmessage = event => receive(event.data);
  return () => {window.removeEventListener(eventName, local); channel?.close();};
}
