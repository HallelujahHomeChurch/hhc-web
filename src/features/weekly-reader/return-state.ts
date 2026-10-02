import type {BulletinReaderMutation} from '@hallelujahhomechurch/hhc-web-client';

type Binding = {accountId: string; documentId: string};
export type ReaderReturn = {
  savedAt: number; revision: number; pageId: string; selected: string[];
  action: BulletinReaderMutation | null;
  draft?: {text: string; noteId?: string; baseVersion?: number};
};
const prefix = 'weekly-reader-return:';
const key = ({accountId, documentId}: Binding) => `${prefix}${accountId}:${documentId}`;
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 128;
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 500 && value.every(id) && new Set(value).size === value.length;
const text = (value: unknown) => typeof value === 'string' && [...value].length <= 10000;
function validAction(value: unknown): value is BulletinReaderMutation | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const action = value as BulletinReaderMutation;
  if (!id(action.mutationId) || !Number.isFinite(Date.parse(action.createdAt)) || !Number.isSafeInteger(action.documentRevision) || action.documentRevision < 1 || !action.payload || typeof action.payload !== 'object') return false;
  switch (action.kind) {
    case 'setHighlight': return ids(action.payload.sentenceIds) && ['yellow', 'red', 'blue'].includes(action.payload.color);
    case 'clearHighlight': return ids(action.payload.sentenceIds);
    case 'createNote': return id(action.payload.noteId) && ids(action.payload.sentenceIds) && text(action.payload.text);
    case 'editNote': return id(action.payload.noteId) && text(action.payload.text) && Number.isSafeInteger(action.baseVersion) && (action.baseVersion ?? 0) > 0;
    case 'deleteNote': return id(action.payload.noteId) && Number.isSafeInteger(action.baseVersion) && (action.baseVersion ?? 0) > 0;
    case 'setProgress': return Object.values(action.payload).every(value => value === '' || id(value));
    case 'resolveHighlightMigrationConflict': return id(action.payload.conflictId) && ['yellow', 'red', 'blue'].includes(action.payload.chosenColor) && Number.isSafeInteger(action.payload.currentRevision);
    default: return false;
  }
}

/** Per-tab, short-lived login recovery; never contains a document, receipt or token. */
export function readReaderReturn(binding: Binding): ReaderReturn | null {
  try {
    const raw = sessionStorage.getItem(key(binding));
    if (!raw) return null;
    if (raw.length > 1024 * 1024) throw new Error('invalid_return');
    const value = JSON.parse(raw) as ReaderReturn;
    const age = Date.now() - value.savedAt;
    if (!Number.isFinite(age) || age < 0 || age >= 30 * 60 * 1000 || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.pageId !== 'string' || value.pageId.length > 128 || !ids(value.selected) || !validAction(value.action) || value.draft && (!text(value.draft.text) || value.draft.noteId !== undefined && !id(value.draft.noteId) || value.draft.baseVersion !== undefined && (!Number.isSafeInteger(value.draft.baseVersion) || value.draft.baseVersion < 1))) throw new Error('invalid_return');
    return value;
  } catch {
    try {sessionStorage.removeItem(key(binding));} catch { /* Storage may be disabled. */ }
    return null;
  }
}
export function saveReaderReturn(binding: Binding, patch: Partial<Omit<ReaderReturn, 'savedAt'>>) {
  const previous = readReaderReturn(binding);
  const value = {...{revision: 0, selected: [], pageId: '', action: null}, ...previous, ...patch, savedAt: Date.now()};
  if (value.revision < 1) return;
  try {sessionStorage.setItem(key(binding), JSON.stringify(value));} catch { /* Optional return recovery; never report a successful note save. */ }
}
/** Logout clears all; account changes keep only the newly authenticated account. */
export function clearReaderReturns(keepAccount?: string) {
  try {
    for (const name of Object.keys(sessionStorage)) if (name.startsWith(prefix) && (!keepAccount || !name.startsWith(`${prefix}${keepAccount}:`))) sessionStorage.removeItem(name);
  } catch { /* Storage may be disabled. */ }
}
export function clearReaderReturn(binding: Binding) {
  try {sessionStorage.removeItem(key(binding));} catch { /* Storage may be disabled. */ }
}
export function hasPendingReaderReturn(accountId: string, documentId?: string) {
  try {
    for (const name of Object.keys(sessionStorage)) {
      if (!name.startsWith(`${prefix}${accountId}:`)) continue;
      const document = name.slice(`${prefix}${accountId}:`.length);
      if (documentId && documentId !== document) continue;
      const value = readReaderReturn({accountId, documentId: document});
      if (value?.action || value?.draft?.text.trim()) return true;
    }
  } catch { /* Storage may be disabled. */ }
  return false;
}
