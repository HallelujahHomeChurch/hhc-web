import {HhcWebApiError, type OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {AccountSessionError} from '@hallelujahhomechurch/account-client';

export type ReaderBinding = Pick<OnlineBulletinAccess['access'], 'accountId' | 'documentId' | 'series' | 'contentLocale' | 'revision'>;
export type OfflineAccess = 'available' | 'expired' | 'revalidation_required' | 'unavailable';
// Anchor a fresh validation in local time without increasing the server ceiling.
export function localAccessDeadline(access: OnlineBulletinAccess['access'], observedAt: number) {
  const expires = Date.parse(access.offlineValidUntil);
  return Math.min(expires, observedAt + expires - Date.parse(access.validatedAt));
}
export function evaluateOfflineAccess(input: {
  binding: ReaderBinding; expected: ReaderBinding;
  validatedAt: number; offlineValidUntil: number; now: number; lastObservedAt: number;
  localValidUntil?: number;
  logoutEpoch: number; currentLogoutEpoch: number; locked: boolean;
}): OfflineAccess {
  const {binding, expected, validatedAt, offlineValidUntil, now, lastObservedAt, logoutEpoch, currentLogoutEpoch, locked} = input;
  if (binding.accountId !== expected.accountId || binding.documentId !== expected.documentId || binding.series !== expected.series || binding.contentLocale !== expected.contentLocale || binding.revision !== expected.revision ||
      !binding.accountId || !binding.documentId || !Number.isSafeInteger(binding.revision) || binding.revision < 1 ||
      ![validatedAt, offlineValidUntil, now, lastObservedAt].every(Number.isFinite) || offlineValidUntil - validatedAt !== 604800000 ||
      !Number.isSafeInteger(logoutEpoch) || logoutEpoch < 0 || logoutEpoch !== currentLogoutEpoch) return 'unavailable';
  const deadline = input.localValidUntil ?? offlineValidUntil;
  if (!Number.isFinite(deadline) || deadline > offlineValidUntil) return 'unavailable';
  if (locked || input.localValidUntil === undefined && now < validatedAt || now < lastObservedAt) return 'revalidation_required';
  return now >= deadline ? 'expired' : 'available';
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
    if ([429, 502, 503, 504].includes(error.status)) return 'retain';
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'not_authenticated') return 'login';
  return error instanceof TypeError ? 'retain' : 'lock';
}
