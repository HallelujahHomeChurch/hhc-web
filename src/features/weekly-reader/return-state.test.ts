import {beforeEach, expect, it, vi} from 'vitest';
import {readReaderReturn, saveReaderReturn, clearReaderReturns} from './return-state';
import {hasPendingReaderWrites} from './offline-store';

beforeEach(() => {sessionStorage.clear(); vi.useRealTimers();});
const binding = {accountId: 'account-a', documentId: 'doc-a'};
const snapshot = {revision: 1, selected: ['s1'], pageId: 'p1', action: null, draft: {text: 'private draft'}};
it('restores only the same account and document, without storing content or credentials', () => {
  saveReaderReturn(binding, snapshot);
  expect(readReaderReturn(binding)).toMatchObject(snapshot);
  expect(readReaderReturn({...binding, accountId: 'account-b'})).toBeNull();
  expect(readReaderReturn({...binding, documentId: 'doc-b'})).toBeNull();
  saveReaderReturn(binding, {selected: ['s2']});
  expect(readReaderReturn(binding)?.draft?.text).toBe('private draft');
  clearReaderReturns('account-b');
  expect(readReaderReturn(binding)).toBeNull();
});
it('expires transient state and rejects a rolled-back clock', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
  saveReaderReturn(binding, snapshot);
  vi.advanceTimersByTime(30 * 60 * 1000);
  expect(readReaderReturn(binding)).toBeNull();
  saveReaderReturn(binding, snapshot);
  vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
  expect(readReaderReturn(binding)).toBeNull();
  vi.useRealTimers();
});
it('keeps the original action identity until explicit acknowledgement or discard', () => {
  const action = {mutationId: '00000000-0000-4000-8000-000000000001', createdAt: new Date().toISOString(), documentRevision: 1, kind: 'createNote' as const, payload: {noteId: '00000000-0000-4000-8000-000000000002', sentenceIds: ['s1'], text: 'draft'}};
  saveReaderReturn(binding, {...snapshot, action});
  saveReaderReturn(binding, {selected: []});
  expect(readReaderReturn(binding)?.action).toEqual(action);
  saveReaderReturn(binding, {action: null});
  expect(readReaderReturn(binding)?.action).toBeNull();
});

it('warns about an unsaved private draft before logout even without an offline replica', async () => {
  saveReaderReturn(binding, snapshot);
  expect(await hasPendingReaderWrites(binding.accountId)).toBe(true);
  expect(await hasPendingReaderWrites('other-account')).toBe(false);
});
