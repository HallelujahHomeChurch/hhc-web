import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {bindResumeDismissalAccount, clearResumeDismissals, dismissResume, isResumeDismissed, isResumeEligible} from './resume-dismissal';

const item = {recordingId: 'recording', mediaVersion: 'vod:package', sessionId: 'session-A', generation: 'generation-A'};
const day = 86400000;
beforeEach(() => { vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime('2026-11-07T00:00:00Z'); clearResumeDismissals(); });
afterEach(() => { vi.restoreAllMocks(); clearResumeDismissals(); vi.useRealTimers(); });

it('suppresses the same owner after reload, but allows another device and a replaced package', async () => {
  dismissResume('member', item);
  vi.resetModules();
  const reloaded = await import('./resume-dismissal');
  expect(reloaded.isResumeDismissed('member', item)).toBe(true);
  expect(isResumeDismissed('member', item)).toBe(true);
  expect(isResumeDismissed('member', {...item, generation: 'generation-B', sessionId: 'session-B'})).toBe(false);
  expect(isResumeDismissed('member', {...item, mediaVersion: 'vod:new-package'})).toBe(false);
  expect(isResumeDismissed('another-member', item)).toBe(false);
});

it('identifies an accepted late claim by session without hiding another device', () => {
  dismissResume('member', {...item, generation: undefined});
  expect(isResumeDismissed('member', item)).toBe(true);
  expect(isResumeDismissed('member', {...item, sessionId: 'session-B'})).toBe(false);
});

it('retains dismissals for different items without clearing cloud progress', () => {
  dismissResume('member', item);
  dismissResume('member', {...item, recordingId: 'other'});
  expect(isResumeDismissed('member', item)).toBe(true);
  expect(isResumeDismissed('member', {...item, recordingId: 'other'})).toBe(true);
});

it('expires local dismissal after thirty days and clears it on logout', () => {
  dismissResume('member', item);
  vi.setSystemTime(Date.now() + 30 * day);
  expect(isResumeDismissed('member', item)).toBe(false);
  dismissResume('member', item);
  clearResumeDismissals();
  expect(isResumeDismissed('member', item)).toBe(false);
});

it('keeps an in-memory fallback when storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  dismissResume('member', item);
  expect(isResumeDismissed('member', item)).toBe(true);
});

it('requires saved positive progress beyond a claim and bounds stale candidates', () => {
  const candidate = {positionSeconds: 2, claimedAt: new Date(Date.now() - 10000).toISOString(), updatedAt: new Date().toISOString()};
  expect(isResumeEligible(candidate)).toBe(true);
  expect(isResumeEligible({...candidate, positionSeconds: 0})).toBe(false);
  expect(isResumeEligible({...candidate, updatedAt: candidate.claimedAt})).toBe(false);
  expect(isResumeEligible({...candidate, updatedAt: 'invalid'})).toBe(false);
  vi.setSystemTime(Date.now() + 30 * day);
  expect(isResumeEligible(candidate)).toBe(false);
});


it('clears old account metadata when binding another signed-in account', () => {
  dismissResume('member', item);
  bindResumeDismissalAccount('other-member');
  bindResumeDismissalAccount('member');
  expect(isResumeDismissed('member', item)).toBe(false);
});


it('preserves an existing per-tab dismissal when moving to durable local storage', () => {
  sessionStorage.setItem('hhc:continue-watching-dismissal', JSON.stringify({member: 'member', generation: item.generation}));
  expect(isResumeDismissed('member', item)).toBe(true);
  sessionStorage.removeItem('hhc:continue-watching-dismissal');
  expect(isResumeDismissed('member', item)).toBe(true);
});

it('clears legacy-only metadata across account switches', () => {
  sessionStorage.setItem('hhc:continue-watching-dismissal', JSON.stringify({member: 'member', generation: item.generation}));
  bindResumeDismissalAccount('other-member');
  bindResumeDismissalAccount('member');
  expect(isResumeDismissed('member', item)).toBe(false);
});

it('does not resurrect cleared metadata when only removal fails', () => {
  dismissResume('member', item);
  sessionStorage.setItem('hhc:continue-watching-dismissal', JSON.stringify({member: 'member', generation: item.generation}));
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  clearResumeDismissals();
  expect(isResumeDismissed('member', item)).toBe(false);
});
