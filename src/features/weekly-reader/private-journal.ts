import type {BulletinReaderMutation, BulletinReaderMutationResponse, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import type {PrivateReplica} from './offline-store';
import {applyLocalMutation, verifyPrivateState} from './private-state';

export function appendPrivateIntent(replica: PrivateReplica, mutation: BulletinReaderMutation, document: MemberOnlineDocument): PrivateReplica {
  const existing = replica.queue.find(entry => entry.mutation.mutationId === mutation.mutationId);
  if (existing) {
    if (JSON.stringify(existing.mutation) !== JSON.stringify(mutation)) throw new Error('mutation_id_conflict');
    return replica;
  }
  if (replica.queue.some(entry => entry.result || entry.replay || entry.resolution || entry.recoveryReason)) throw new Error('action_required');
  const state = applyLocalMutation(replica.state, mutation, document);
  const queue = mutation.kind === 'setProgress' ? replica.queue.filter(entry => entry.sent || entry.mutation.kind !== 'setProgress') : replica.queue;
  return {...replica, state, queue: [...queue, {mutation: structuredClone(mutation), sent: false}]};
}

export function acknowledgePrivateIntent(replica: PrivateReplica, response: BulletinReaderMutationResponse, document: MemberOnlineDocument): PrivateReplica {
  if (response.results.length !== 1 || response.results[0].mutationId !== replica.queue[0]?.mutation.mutationId) throw new Error('invalid_reader_binding');
  verifyPrivateState(response.state, replica.state.accountId, document.documentId, document.revision);
  const acknowledged = response.results[0];
  const bookmarks = new Map((replica.confirmed.bookmarks ?? []).map(bookmark => [bookmark.id, bookmark]));
  for (const bookmark of response.state.bookmarks ?? []) if ((bookmarks.get(bookmark.id)?.version ?? 0) <= bookmark.version) bookmarks.set(bookmark.id, bookmark);
  const cloud = response.state.bookmarks || replica.confirmed.bookmarks ? {...response.state, bookmarks: [...bookmarks.values()]} : response.state;
  if (cloud.currentRevision !== document.revision || acknowledged.status !== 'applied') return {...replica, confirmed: cloud.currentRevision === document.revision ? cloud : replica.confirmed, queue: replica.queue.map((entry, index) => index ? entry : {...entry, result: acknowledged})};
  const queue = replica.queue.slice(1).map(entry => ({...entry}));
  let state = cloud;
  for (const entry of queue) {
    try {state = applyLocalMutation(state, entry.mutation, document);}
    catch {
      state = replica.state;
      entry.result = {mutationId: entry.mutation.mutationId, revision: state.currentRevision, status: 'note_conflict'};
      break;
    }
  }
  return {state, confirmed: cloud, queue};
}

export function isReaderStorageFailure(error: unknown) {
  return error instanceof DOMException && ['QuotaExceededError', 'SecurityError', 'InvalidStateError', 'UnknownError', 'NotSupportedError'].includes(error.name);
}
