import {describe, expect, it} from 'vitest';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {AccountSessionError} from '@hallelujahhomechurch/account-client';
import {evaluateOfflineAccess, readerFailureAction} from './offline-access';

const binding = {accountId: 'a', documentId: 'd', series: 'general', contentLocale: 'zh-Hant', revision: 1} as const;
const start = Date.parse('2026-10-01T00:00:00Z');
const input = {binding, expected: binding, validatedAt: start, offlineValidUntil: start + 604800000, now: start + 1000, lastObservedAt: start, logoutEpoch: 0, currentLogoutEpoch: 0, locked: false};
describe('seven-day explicit offline access', () => {
  it.each([[0, 'available'], [604799999, 'available'], [604800000, 'expired'], [604800001, 'expired']] as const)('evaluates the exact %i millisecond boundary', (elapsed, expected) => {
    expect(evaluateOfflineAccess({...input, now: start + elapsed})).toBe(expected);
  });
  it('locks clock rollback and an explicitly locked edition without renewing the receipt', () => {
    expect(evaluateOfflineAccess({...input, now: start - 1})).toBe('revalidation_required');
    expect(evaluateOfflineAccess({...input, lastObservedAt: input.now + 1})).toBe('revalidation_required');
    expect(evaluateOfflineAccess({...input, locked: true})).toBe('revalidation_required');
    expect(input.offlineValidUntil).toBe(start + 604800000);
  });
  it.each(['accountId', 'documentId', 'series', 'contentLocale', 'revision'] as const)('rejects a different %s', key => {
    expect(evaluateOfflineAccess({...input, expected: {...binding, [key]: key === 'revision' ? 2 : 'other'}})).toBe('unavailable');
  });
  it('rejects stale logout epochs and corrupt/extended timestamps', () => {
    expect(evaluateOfflineAccess({...input, currentLogoutEpoch: 1})).toBe('unavailable');
    expect(evaluateOfflineAccess({...input, offlineValidUntil: input.offlineValidUntil + 1})).toBe('unavailable');
    expect(evaluateOfflineAccess({...input, now: NaN})).toBe('unavailable');
  });
  it('purges only marked owner unavailability; route errors lock without erasing notes', () => {
    expect(readerFailureAction(new HhcWebApiError(404, 'not_found', 'unavailable', undefined, undefined, true))).toBe('purge');
    expect(readerFailureAction(new HhcWebApiError(404, 'not_found', 'route'))).toBe('lock');
    expect(readerFailureAction(new HhcWebApiError(404, 'unknown', 'route', undefined, undefined, true))).toBe('lock');
    expect(readerFailureAction(new HhcWebApiError(401, 'unauthorized', 'login'))).toBe('login');
    expect(readerFailureAction(new HhcWebApiError(503, 'unavailable', 'dependency'))).toBe('retain');
    expect(readerFailureAction(new TypeError('network'))).toBe('retain');
  });
  it('handles existing Account-runtime errors before member fetch without renewing access', () => {
    expect(readerFailureAction(new AccountSessionError(401, 'ACC_AUTH_REQUIRED'))).toBe('login');
    for (const status of [0, 429, 502, 503, 504]) expect(readerFailureAction(new AccountSessionError(status))).toBe('retain');
    expect(readerFailureAction(new AccountSessionError(404, 'INVALID_RESPONSE'))).toBe('lock');
  });
});
