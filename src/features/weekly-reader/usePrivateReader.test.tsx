import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {HhcWebApiError, type BulletinReaderMutation, type BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {usePrivateReader} from './usePrivateReader';
import {applyLocalMutation} from './private-state';
import {readReaderReturn, saveReaderReturn} from './return-state';
vi.mock('./offline-store', async original => ({...await original<typeof import('./offline-store')>(), supportsOfflineReader: () => false}));
const value = readerFixture();
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const state: BulletinReaderState = {accountId: selector.accountId, documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
const mutation: BulletinReaderMutation = {mutationId: 'id', documentRevision: 1, createdAt: new Date().toISOString(), kind: 'setHighlight', payload: {sentenceIds: ['s0'], color: 'yellow'}};
const api = {privateState: vi.fn(), mutate: vi.fn(), renew: vi.fn()}, onFailure = vi.fn();
let cloud: BulletinReaderState;
beforeEach(() => {vi.resetAllMocks(); sessionStorage.clear(); cloud = structuredClone(state); api.privateState.mockImplementation(async () => ({state: structuredClone(cloud)})); api.mutate.mockImplementation(async (_selector, _value, writes) => {cloud = applyLocalMutation(cloud, writes[0], value.document); return {state: cloud, results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]};});});
function mount(permitted = {value: true}) {return renderHook(() => usePrivateReader({api, selector, value, offline: false, allowAction: () => permitted.value, onFailure}));}
it('accepts locally and returns before network acknowledgement without a foreground busy operation', async () => {
  api.mutate.mockImplementationOnce(() => new Promise(() => {}));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  const accepted = vi.fn();
  await act(async () => {expect(await h.result.current.mutate(mutation, false, accepted)).toEqual({status: 'queued', durable: false});});
  expect(accepted).toHaveBeenCalledOnce(); expect(h.result.current.state?.highlights[0].color).toBe('yellow');
  expect(h.result.current.operation).toBe('idle'); expect(h.result.current.unsaved).toBe(true);
});
it.each(['network', 'reader_request_timeout'])('retains optimistic content after %s failure and retries the exact immutable ID', async failure => {
  api.mutate.mockRejectedValueOnce(new TypeError(failure));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  await act(async () => {await h.result.current.mutate(mutation);});
  await waitFor(() => expect(h.result.current.status).toBe('waiting'));
  expect(h.result.current.state?.highlights[0].color).toBe('yellow'); expect(h.result.current.canRetry).toBe(true);
  await act(async () => {await h.result.current.retry();});
  expect(api.mutate.mock.calls[1][2]).toEqual([mutation]); expect(h.result.current.unsaved).toBe(false);
});
it('projects consecutive edits while a previous acknowledgement is delayed, retaining CAS and final text', async () => {
  const note = {id: 'n', text: 'A', quote: '內容0。', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  cloud = {...state, notes: [note]};
  let finish!: () => void;
  api.mutate.mockImplementationOnce(async (_s, _v, writes) => {await new Promise<void>(resolve => {finish = resolve;}); cloud = applyLocalMutation(cloud, writes[0], value.document); return {state: cloud, results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]};});
  const h = mount(); await waitFor(() => expect(h.result.current.state?.notes[0].text).toBe('A'));
  const a: BulletinReaderMutation = {...mutation, mutationId: 'a', kind: 'editNote', baseVersion: 1, payload: {noteId: 'n', text: 'B'}};
  const b: BulletinReaderMutation = {...a, mutationId: 'b', baseVersion: 2, payload: {noteId: 'n', text: 'C'}};
  await act(async () => {await h.result.current.mutate(a);}); await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  await act(async () => {await h.result.current.mutate(b);}); expect(h.result.current.state?.notes[0]).toMatchObject({text: 'C', version: 3});
  await act(async () => finish()); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.result.current.state?.notes[0]).toMatchObject({text: 'C', version: 3}); expect(api.mutate.mock.calls.map(call => call[2][0])).toEqual([a, b]);
});
it('warns on page termination only while memory-only intents remain', async () => {
  api.mutate.mockRejectedValueOnce(new TypeError('offline'));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  await act(async () => {await h.result.current.mutate(mutation);}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  const warn = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(warn); expect(warn.defaultPrevented).toBe(true);
  await act(async () => {await h.result.current.retry();});
  const clear = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(clear); expect(clear.defaultPrevented).toBe(false);
});
it('does not retry an unknown ID merely because the component remounts', async () => {
  saveReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}, {revision: 1, action: mutation});
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  expect(api.mutate).not.toHaveBeenCalled(); expect(h.result.current.canRetry).toBe(true);
  await act(async () => {await h.result.current.retry();}); expect(api.mutate.mock.calls[0][2]).toEqual([mutation]);
  expect(readReaderReturn({accountId: selector.accountId, documentId: value.document.documentId})?.action).toBeNull();
});
it('pauses on revision change while retaining original intent for explicit recovery', async () => {
  api.mutate.mockResolvedValueOnce({state: {...state, currentRevision: 2, appliedRevision: 2}, results: [{mutationId: mutation.mutationId, status: 'revision_changed', revision: 2}]});
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state)); await act(async () => {await h.result.current.mutate(mutation);});
  await waitFor(() => expect(h.result.current.status).toBe('paused')); expect(h.result.current.pendingMutation).toEqual(mutation);
  await expect(h.result.current.mutate({...mutation, mutationId: 'new'})).rejects.toThrow();
});
it('coalesces unsent progress without discarding the sent ID or a user intent', async () => {
  let finish!: () => void;
  api.mutate.mockImplementationOnce(async (_s, _v, writes) => {await new Promise<void>(resolve => {finish = resolve;}); return {state, results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]};});
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  const progress = (id: string): BulletinReaderMutation => ({...mutation, mutationId: id, kind: 'setProgress', payload: {pageId: 'p1'}});
  await act(async () => {await h.result.current.mutate(progress('first'));}); await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  await act(async () => {await h.result.current.mutate(mutation); await h.result.current.mutate(progress('old')); await h.result.current.mutate(progress('latest'));});
  await act(async () => finish()); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(api.mutate.mock.calls.map(call => call[2][0].mutationId)).toEqual(['first', mutation.mutationId, 'latest']);
});
it('does not abort an accepted save during same-binding receipt refresh', async () => {
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});}));
  const h = renderHook(({current}) => usePrivateReader({api, selector, value: current, offline: false, allowAction: () => true, onFailure}), {initialProps: {current: value}});
  await waitFor(() => expect(h.result.current.state).toEqual(state)); await act(async () => {await h.result.current.mutate(mutation);}); await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  h.rerender({current: {...structuredClone(value), access: {...value.access, receiptId: 'fresh'}}});
  expect(api.mutate.mock.calls[0][3].aborted).toBe(false);
  await act(async () => finish()); await waitFor(() => expect(h.result.current.status).toBe('synced'));
  expect(h.result.current.canRetry).toBe(false); expect(api.privateState).toHaveBeenCalledOnce();
});
it('rejects new intent on expired authorization, and ignores a late response after unmount', async () => {
  let finish!: () => void; const permitted = {value: true};
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});}));
  const h = mount(permitted); await waitFor(() => expect(h.result.current.state).toEqual(state)); await act(async () => {await h.result.current.mutate(mutation);}); await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  permitted.value = false; await expect(h.result.current.mutate({...mutation, mutationId: 'denied'})).rejects.toThrow(); h.unmount();
  await act(async () => finish()); expect(api.mutate).toHaveBeenCalledOnce(); expect(onFailure).not.toHaveBeenCalled();
});
it('delegates owner denial and does not expose a newer revision to the pinned renderer', async () => {
  api.privateState.mockRejectedValueOnce(new HhcWebApiError(404, 'not_found', 'Unavailable', undefined, undefined, true));
  const h = mount(); await waitFor(() => expect(h.result.current.status).toBe('action')); expect(h.result.current.state).toBeNull(); expect(onFailure).toHaveBeenCalledOnce(); h.unmount();
  api.privateState.mockResolvedValueOnce({state: {...state, currentRevision: 2, appliedRevision: 2}});
  const newer = mount(); await waitFor(() => expect(newer.result.current.status).toBe('paused')); expect(newer.result.current.state).toBeNull();
});
it('retains later memory intents when explicitly resolving the head during recovery', async () => {
  api.mutate.mockRejectedValue(new TypeError('offline'));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  await act(async () => {await h.result.current.mutate(mutation); await h.result.current.mutate({...mutation, mutationId: 'later', payload: {sentenceIds: ['s1'], color: 'blue'}});}); await waitFor(() => expect(h.result.current.busy).toBe(false));
  expect(() => h.result.current.replacePending(null, 'different-intent')).toThrow('pending_action_changed');
  act(() => {expect(h.result.current.replacePending(null, mutation.mutationId)?.mutationId).toBe('later');}); expect(h.result.current.unsaved).toBe(true); expect(h.result.current.pendingMutation?.mutationId).toBe('later');
});

it('isolates a new account while an old memory-only send is still completing', async () => {
  let finish!: () => void;
  api.mutate.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({state, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]});}));
  const h = renderHook(({accountId}) => usePrivateReader({api, selector: {...selector, accountId}, value: {...value, access: {...value.access, accountId}}, offline: false, allowAction: () => true, onFailure}), {initialProps: {accountId: selector.accountId}});
  await waitFor(() => expect(h.result.current.state?.accountId).toBe(selector.accountId)); await act(async () => {await h.result.current.mutate(mutation);}); await waitFor(() => expect(api.mutate).toHaveBeenCalledOnce());
  api.privateState.mockResolvedValue({state: {...state, accountId: 'account-b'}}); h.rerender({accountId: 'account-b'});
  await expect(h.result.current.mutate({...mutation, mutationId: 'denied'})).rejects.toThrow();
  await act(async () => finish()); await waitFor(() => expect(h.result.current.state?.accountId).toBe('account-b'));
  expect(h.result.current.pendingMutation).toBeNull(); expect(api.mutate).toHaveBeenCalledOnce(); expect(h.result.current.state?.highlights).toEqual([]);
});

it('does not resend a memory intent beyond the server idempotency window', async () => {
  const expired = {...mutation, mutationId: 'expired', createdAt: new Date(Date.now() - 91 * 86400000).toISOString()};
  saveReaderReturn({accountId: selector.accountId, documentId: value.document.documentId}, {revision: 1, action: expired});
  const h = mount(); await waitFor(() => expect(h.result.current.state).toEqual(state));
  await act(async () => {await h.result.current.retry();});
  expect(api.mutate).not.toHaveBeenCalled(); expect(h.result.current.status).toBe('action'); expect(h.result.current.pendingMutation).toEqual(expired);
});
