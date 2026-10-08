import {beforeEach, expect, it, vi} from 'vitest';
import {readReaderReturn, saveReaderReturn, clearReaderReturns, clearReaderEditionReturn} from './return-state';
import {hasPendingReaderWrites} from './offline-store';

beforeEach(() => {sessionStorage.clear(); vi.useRealTimers();});
const binding = {accountId: 'account-a', documentId: 'doc-a'};
const snapshot = {revision: 1, selected: ['s1'], pageId: 'p1', action: null, draft: {text: 'private draft'}};
it('retains historical highlight intent through login without accepting a restore without ranges', () => {
  const common = {mutationId: 'history-action', createdAt: new Date().toISOString(), documentRevision: 1};
  const restore = {...common, kind: 'restoreHighlight' as const, payload: {historyId: 'history', sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 0, end: 2}], color: 'blue' as const}};
  for (const action of [restore, {...common, kind: 'discardHighlightHistory' as const, payload: {historyId: 'history'}}]) {
    saveReaderReturn(binding, {...snapshot, action});
    expect(readReaderReturn(binding)?.action).toEqual(action);
  }
  saveReaderReturn(binding, {...snapshot, action: restore});
  const persisted = JSON.parse(sessionStorage.getItem('weekly-reader-return:account-a:doc-a')!);
  delete persisted.action.payload.ranges;
  sessionStorage.setItem('weekly-reader-return:account-a:doc-a', JSON.stringify(persisted));
  expect(readReaderReturn(binding)).toBeNull();
});
it('retains a versioned reanchor action through login and rejects missing ranges', () => {
  const action = {mutationId: 'reanchor', createdAt: new Date().toISOString(), documentRevision: 1, baseVersion: 2, kind: 'reanchorNote' as const, payload: {noteId: 'note', sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 0, end: 2}]}};
  saveReaderReturn(binding, {...snapshot, action});
  expect(readReaderReturn(binding)?.action).toEqual(action);
  const persisted = JSON.parse(sessionStorage.getItem('weekly-reader-return:account-a:doc-a')!);
  delete persisted.action.payload.ranges;
  sessionStorage.setItem('weekly-reader-return:account-a:doc-a', JSON.stringify(persisted));
  expect(readReaderReturn(binding)).toBeNull();
});
it('restores exact partial ranges and rejects malformed persisted offsets', () => {
  const selectedRanges = [{sentenceId: 's1', start: 1, end: 3}];
  saveReaderReturn(binding, {...snapshot, selectedRanges});
  expect(readReaderReturn(binding)?.selectedRanges).toEqual(selectedRanges);
  saveReaderReturn(binding, {selectedRanges: [{sentenceId: 's1', start: -1, end: 3}]});
  expect(readReaderReturn(binding)).toBeNull();
});
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
it('purges a denied edition on fresh login without deleting another edition or account', () => {
  const edition = {issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
  saveReaderReturn(binding, {...snapshot, edition});
  saveReaderReturn({...binding, documentId: 'doc-b'}, {...snapshot, edition: {...edition, issueNumber: 1740}});
  saveReaderReturn({...binding, accountId: 'account-b'}, {...snapshot, edition});
  clearReaderEditionReturn({...edition, accountId: binding.accountId});
  expect(readReaderReturn(binding)).toBeNull();
  expect(readReaderReturn({...binding, documentId: 'doc-b'})).not.toBeNull();
  expect(readReaderReturn({...binding, accountId: 'account-b'})).not.toBeNull();
});
