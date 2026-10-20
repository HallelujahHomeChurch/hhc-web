import type {BulletinReaderMutation} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderSelector} from './api';
import type {ReaderTextRange} from './text-range';
import type {PrivateReplica} from './offline-store';

type Binding = {accountId: string; documentId: string};
export type ReaderReturn = {
  edition?: Omit<ReaderSelector, 'accountId'>;
  savedAt: number; revision: number; pageId: string; selected: string[];
  selectedRanges?: ReaderTextRange[];
  action: BulletinReaderMutation | null;
  draft?: {text: string; noteId?: string; baseVersion?: number};
};
const prefix = 'weekly-reader-return:';
const key = ({accountId, documentId}: Binding) => `${prefix}${accountId}:${documentId}`;
// Keep the same RAM journal through a temporary auth unmount; never persist it as a second queue.
const volatile = new Map<string, {selector: ReaderSelector; revision: number; epoch: number | null; replica: PrivateReplica}>();
export function readVolatileReader(binding: Binding) {return volatile.get(key(binding));}
export function retainVolatileReader(selector: ReaderSelector, revision: number, epoch: number | null, replica: PrivateReplica, needed: boolean) {
  const name = key({accountId: selector.accountId, documentId: replica.state.documentId});
  if (!needed || !replica.queue.length) {volatile.delete(name); return;}
  volatile.delete(name); volatile.set(name, {selector, revision, epoch, replica});
  while (volatile.size > 8) volatile.delete(volatile.keys().next().value!);
}
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 128;
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 500 && value.every(id) && new Set(value).size === value.length;
const text = (value: unknown) => typeof value === 'string' && [...value].length <= 10000;
const ranges = (value: unknown, anchors: string[]) => value === undefined || Array.isArray(value) && value.length > 0 && value.length === anchors.length && new Set(value.map(range => range?.sentenceId)).size === value.length && value.every(range => range && anchors.includes(range.sentenceId) && Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start >= 0 && range.start < range.end && range.end <= 1000000);
function validAction(value: unknown): value is BulletinReaderMutation | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const action = value as BulletinReaderMutation;
  if (!id(action.mutationId) || !Number.isFinite(Date.parse(action.createdAt)) || !Number.isSafeInteger(action.documentRevision) || action.documentRevision < 1 || !action.payload || typeof action.payload !== 'object') return false;
  if ('ranges' in action.payload && (!('sentenceIds' in action.payload) || !ids(action.payload.sentenceIds) || !ranges(action.payload.ranges, action.payload.sentenceIds))) return false;
  switch (action.kind) {
    case 'setHighlight': return ids(action.payload.sentenceIds) && ['yellow', 'red', 'blue'].includes(action.payload.color);
    case 'clearHighlight': return ids(action.payload.sentenceIds);
    case 'restoreHighlight': return id(action.payload.historyId) && ids(action.payload.sentenceIds) && action.payload.sentenceIds.length > 0 && Array.isArray(action.payload.ranges) && ranges(action.payload.ranges, action.payload.sentenceIds) && ['yellow', 'red', 'blue'].includes(action.payload.color);
    case 'discardHighlightHistory': return id(action.payload.historyId);
    case 'createNote': return id(action.payload.noteId) && ids(action.payload.sentenceIds) && text(action.payload.text);
    case 'reanchorNote': return id(action.payload.noteId) && ids(action.payload.sentenceIds) && action.payload.sentenceIds.length > 0 && Array.isArray(action.payload.ranges) && ranges(action.payload.ranges, action.payload.sentenceIds) && Number.isSafeInteger(action.baseVersion) && (action.baseVersion ?? 0) > 0;
    case 'editNote': return id(action.payload.noteId) && text(action.payload.text) && Number.isSafeInteger(action.baseVersion) && (action.baseVersion ?? 0) > 0;
    case 'deleteNote': return id(action.payload.noteId) && Number.isSafeInteger(action.baseVersion) && (action.baseVersion ?? 0) > 0;
    case 'createBookmark': return action.baseVersion === undefined && id(action.payload.bookmarkId) && typeof action.payload.name === 'string' && [...action.payload.name.trim()].length > 0 && [...action.payload.name.trim()].length <= 80 && id(action.payload.sentenceId) && id(action.payload.pageId) && Number.isSafeInteger(action.payload.offset) && action.payload.offset >= 0;
    case 'renameBookmark': return id(action.payload.bookmarkId) && typeof action.payload.name === 'string' && [...action.payload.name.trim()].length > 0 && [...action.payload.name.trim()].length <= 80 && Number.isSafeInteger(action.baseVersion) && action.baseVersion > 0;
    case 'deleteBookmark': return id(action.payload.bookmarkId) && Number.isSafeInteger(action.baseVersion) && action.baseVersion > 0;
    case 'reanchorBookmark': return id(action.payload.bookmarkId) && id(action.payload.sentenceId) && id(action.payload.pageId) && Number.isSafeInteger(action.payload.offset) && action.payload.offset >= 0 && Number.isSafeInteger(action.baseVersion) && action.baseVersion > 0;
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
    if (!ranges(value.selectedRanges, value.selected)) throw new Error('invalid_return');
    const age = Date.now() - value.savedAt;
    if (!Number.isFinite(age) || age < 0 || age >= 30 * 60 * 1000 || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.pageId !== 'string' || value.pageId.length > 128 || !ids(value.selected) || !validAction(value.action)) throw new Error('invalid_return');
    // A legal manual merge may contain two complete notes before editing down.
    if (value.draft && (typeof value.draft.text !== 'string' || [...value.draft.text].length > 20002 || value.draft.noteId !== undefined && !id(value.draft.noteId) || value.draft.baseVersion !== undefined && (!Number.isSafeInteger(value.draft.baseVersion) || value.draft.baseVersion < 1))) delete value.draft;
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
  for (const [name, value] of volatile) if (value.selector.accountId !== keepAccount) volatile.delete(name);
  try {
    for (const name of Object.keys(sessionStorage)) if (name.startsWith(prefix) && (!keepAccount || !name.startsWith(`${prefix}${keepAccount}:`))) sessionStorage.removeItem(name);
  } catch { /* Storage may be disabled. */ }
}
export function clearReaderReturn(binding: Binding) {
  volatile.delete(key(binding));
  try {sessionStorage.removeItem(key(binding));} catch { /* Storage may be disabled. */ }
}
export function clearReaderEditionReturn(selector: ReaderSelector) {
  for (const [name, value] of volatile) if (value.selector.accountId === selector.accountId && value.selector.issueNumber === selector.issueNumber && value.selector.series === selector.series && value.selector.contentLocale === selector.contentLocale) volatile.delete(name);
  try {
    for (const name of Object.keys(sessionStorage)) {
      if (!name.startsWith(`${prefix}${selector.accountId}:`)) continue;
      const binding = {accountId: selector.accountId, documentId: name.slice(`${prefix}${selector.accountId}:`.length)};
      const edition = readReaderReturn(binding)?.edition;
      if (edition?.issueNumber === selector.issueNumber && edition.series === selector.series && edition.contentLocale === selector.contentLocale) clearReaderReturn(binding);
    }
  } catch { /* Storage may be disabled. */ }
}
export function hasPendingReaderReturn(accountId: string, documentId?: string) {
  for (const value of volatile.values()) if (value.selector.accountId === accountId && (!documentId || value.replica.state.documentId === documentId)) return true;
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

/** Exact per-tab snapshot for a removal decision; storage denial must fail closed. */
export function readerReturnSnapshot(binding: Binding) {
  const stored = sessionStorage.getItem(key(binding)), ram = readVolatileReader(binding);
  return ram ? JSON.stringify([stored, ram.revision, ram.epoch, ram.replica.queue]) : stored;
}
export function clearReaderReturnIfUnchanged(binding: Binding, expected: string | null) {
  try {if (readerReturnSnapshot(binding) === expected) clearReaderReturn(binding);} catch { /* Retain recovery when storage cannot be checked. */ }
}
