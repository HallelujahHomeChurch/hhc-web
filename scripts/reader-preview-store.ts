import type {BulletinReaderMutation, BulletinReaderMutationResponse, BulletinReaderState, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {applyLocalMutation} from '../src/features/weekly-reader/private-state';

/** Local-only UI simulation. Never import this module into the application. */
export function createReaderPreviewStore() {
  const documents = new Map<string, BulletinReaderState>();
  const receipts = new Map<string, {fingerprint: string; result: BulletinReaderMutationResponse['results'][number]}>();
  let failing = false;
  const read = (document: MemberOnlineDocument) => structuredClone(documents.get(document.documentId) ?? {accountId: 'local-fixture-account', documentId: document.documentId, appliedRevision: document.revision, currentRevision: document.revision, highlights: [], notes: [], conflicts: [], progress: null});
  return {
    read,
    failNext() {failing = true;},
    mutate(document: MemberOnlineDocument, mutations: BulletinReaderMutation[]): BulletinReaderMutationResponse {
      if (failing) {failing = false; throw new Error('simulated_failure');}
      if (!Array.isArray(mutations) || !mutations.length || mutations.length > 100 || JSON.stringify(mutations).length > 1024 * 1024) throw new Error('invalid_fixture_mutations');
      let state = read(document);
      const staged = new Map(receipts), results: BulletinReaderMutationResponse['results'] = [];
      for (const mutation of mutations) {
        const fingerprint = JSON.stringify(mutation);
        const key = `${document.documentId}:${mutation.mutationId}`, previous = staged.get(key);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new Error('mutation_reuse');
          results.push(previous.result); continue;
        }
        state = applyLocalMutation(state, mutation, document);
        const note = 'noteId' in mutation.payload ? state.notes.find(note => note.id === mutation.payload.noteId) : undefined;
        const result = {mutationId: mutation.mutationId, status: 'applied' as const, revision: document.revision, ...(note ? {note} : {})};
        staged.set(key, {fingerprint, result}); results.push(result);
      }
      documents.set(document.documentId, structuredClone(state));
      for (const [key, receipt] of staged) receipts.set(key, receipt);
      return {state, results};
    }
  };
}
