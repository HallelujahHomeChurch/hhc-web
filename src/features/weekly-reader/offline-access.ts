import {HhcWebApiError, type OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {AccountSessionError} from '@hallelujahhomechurch/account-client';

export type ReaderBinding = Pick<OnlineBulletinAccess['access'], 'accountId' | 'documentId' | 'series' | 'contentLocale' | 'revision'>;
export type OfflineAccess = 'available' | 'expired' | 'revalidation_required' | 'unavailable';
export function evaluateOfflineAccess(input: {
  binding: ReaderBinding; expected: ReaderBinding;
  validatedAt: number; offlineValidUntil: number; now: number; lastObservedAt: number;
  logoutEpoch: number; currentLogoutEpoch: number; locked: boolean;
}): OfflineAccess {
  const {binding, expected, validatedAt, offlineValidUntil, now, lastObservedAt, logoutEpoch, currentLogoutEpoch, locked} = input;
  if (binding.accountId !== expected.accountId || binding.documentId !== expected.documentId || binding.series !== expected.series || binding.contentLocale !== expected.contentLocale || binding.revision !== expected.revision ||
      !binding.accountId || !binding.documentId || !Number.isSafeInteger(binding.revision) || binding.revision < 1 ||
      ![validatedAt, offlineValidUntil, now, lastObservedAt].every(Number.isFinite) || offlineValidUntil - validatedAt !== 604800000 ||
      !Number.isSafeInteger(logoutEpoch) || logoutEpoch < 0 || logoutEpoch !== currentLogoutEpoch) return 'unavailable';
  if (locked || now < validatedAt || now < lastObservedAt) return 'revalidation_required';
  return now >= offlineValidUntil ? 'expired' : 'available';
}

export function readerFailureAction(error: unknown): 'purge' | 'lock' | 'retain' | 'login' {
  if (error instanceof AccountSessionError) {
    if (error.status === 401) return 'login';
    if ([0, 429, 502, 503, 504].includes(error.status)) return 'retain';
    return 'lock';
  }
  if (error instanceof HhcWebApiError) {
    if (error.status === 404) return error.code === 'not_found' && error.bulletinUnavailable ? 'purge' : 'lock';
    if (error.status === 401) return 'login';
    if ([502, 503, 504].includes(error.status)) return 'retain';
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'not_authenticated') return 'login';
  return error instanceof TypeError ? 'retain' : 'lock';
}
