import {useLayoutEffect, useRef} from 'react';
import {bulletinChapters} from '@hallelujahhomechurch/ui';
import type {BulletinReaderBookmark, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {bookmarkTargets, type BookmarkTarget} from '@/features/weekly-reader/bookmarks';
import {readerSentences} from '@/features/weekly-reader/selection';
import type {ReaderMessages} from './ReaderToolbar';
export type BookmarkDraft = {kind: 'create' | 'rename' | 'reanchor' | 'delete'; id: string; name: string; originalName: string; baseVersion?: number; target: BookmarkTarget | null; conflict?: BulletinReaderBookmark; error?: string};
export function BookmarksPanel({document, bookmarks, messages: m, offline, supported, busy, cacheWarning, draft, onDraft, onCurrent, onSave, onJump, onDelete}: {
  document: MemberOnlineDocument; bookmarks: BulletinReaderBookmark[] | undefined; messages: ReaderMessages; offline: boolean; supported: boolean; busy: boolean; cacheWarning: boolean;
  draft: BookmarkDraft | null; onDraft: (draft: BookmarkDraft | null) => void; onCurrent: () => BookmarkTarget | null; onSave: () => void;
  onJump: (bookmark: BulletinReaderBookmark) => void; onDelete: (bookmark: BulletinReaderBookmark) => void;
}) {
  const root = useRef<HTMLElement>(null), addButton = useRef<HTMLButtonElement>(null);
  const previousDraft = useRef(draft), restoreFocus = useRef<BookmarkDraft | null>(null);
  useLayoutEffect(() => {
    if (previousDraft.current && !draft) restoreFocus.current = previousDraft.current;
    previousDraft.current = draft;
    if (draft || busy || !restoreFocus.current) return;
    const previous = restoreFocus.current; restoreFocus.current = null;
    const trigger = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-bookmark-action]') ?? []).find(button => button.dataset.bookmarkId === previous.id && button.dataset.bookmarkAction === previous.kind && !button.disabled);
    const fallback = !addButton.current?.disabled ? addButton.current : root.current?.querySelector<HTMLButtonElement>('[data-bookmark-action]:not(:disabled)');
    (trigger ?? fallback ?? root.current)?.focus();
  }, [draft, busy]);
  const active = bookmarks?.filter(bookmark => !bookmark.deleted) ?? [], disabled = busy || offline || !supported || !bookmarks;
  const sentences = readerSentences(document), targets = bookmarkTargets(document);
  const key = (target: BookmarkTarget | null) => target ? JSON.stringify(target) : '';
  if (draft?.target && !targets.some(target => key(target) === key(draft.target))) targets.unshift(draft.target);
  const position = (target: BookmarkTarget) => `PDF ${document.content.pages.findIndex(page => page.id === target.pageId) + 1} · ${[...(sentences.find(sentence => sentence.id === target.sentenceId)?.text ?? '')].slice(0, 28).join('')}`;
  return <section ref={root} tabIndex={-1} className="reader-bookmarks">
    {!bookmarks || !offline && !supported ? <p role="status">{m.bookmarkUnavailable}</p> : offline ? <p role="status">{m.bookmarkOffline}</p> : null}
    {cacheWarning ? <p role="alert">{m.bookmarkCacheWarning}</p> : null}
    <p>{m.bookmarkCount.replace('{count}', String(active.length))}</p>
    <button ref={addButton} type="button" disabled={disabled || !!draft || active.length >= 100} onClick={() => {const target = onCurrent(), sentence = sentences.find(sentence => sentence.id === target?.sentenceId), chapter = bulletinChapters(document.content).find(chapter => sentence && chapter.componentIds.includes(sentence.componentId)); onDraft({kind: 'create', id: crypto.randomUUID(), name: chapter ? ({cover: m.chapterCover, body: m.chapterBody, worship: m.chapterWorship, back: m.chapterBack})[chapter.id] : m.bookmarkDefault, originalName: '', target});}}>{m.bookmarkAdd}</button>
    {active.length >= 100 ? <p>{m.bookmarkLimit}</p> : null}
    {draft ? <form className="reader-bookmark-form" onSubmit={event => {event.preventDefault(); if (!disabled) onSave();}}>
      <label>{m.bookmarkName}<input autoFocus value={draft.name} disabled={disabled || (draft.kind === 'reanchor' || draft.kind === 'delete')} onChange={event => onDraft({...draft, name: event.target.value, error: undefined})}/></label>
      <p>{[...draft.name.trim()].length} / 80</p>
      {draft.kind !== 'rename' && draft.kind !== 'delete' ? <><label>{m.bookmarkPosition}<select value={key(draft.target)} disabled={disabled} onChange={event => onDraft({...draft, target: targets.find(target => key(target) === event.target.value) ?? null, error: undefined})}>
        <option value="">{m.bookmarkChoosePosition}</option>{targets.map(target => <option key={key(target)} value={key(target)}>{position(target)}</option>)}
      </select></label><button type="button" disabled={disabled} onClick={() => onDraft({...draft, target: onCurrent(), error: undefined})}>{m.bookmarkUseCurrent}</button>{!draft.target ? <p>{m.bookmarkChoosePosition}</p> : null}</> : null}
      {draft.error ? <p role="alert">{draft.error}</p> : null}
      {draft.conflict ? <><h3>{m.recoveryCloud}</h3><p className="reader-note-text">{draft.conflict.deleted ? m.bookmarkDeleted : `${draft.conflict.name} · ${draft.conflict.reanchorRequired || draft.conflict.documentRevision !== document.revision ? m.bookmarkNeedsPosition : position(draft.conflict)}`}</p><h3>{m.recoveryLocal}</h3><p className="reader-note-text">{draft.name}</p><button type="button" disabled={busy} onClick={() => onDraft(null)}>{m.noteCloud}</button>
        {!draft.conflict.deleted && draft.kind !== 'create' ? <button type="button" disabled={disabled} onClick={() => onDraft({...draft, baseVersion: draft.conflict!.version, conflict: undefined, error: undefined})}>{m.noteLocal}</button> : null}</> : null}
      <div className="reader-note-actions"><button type="button" disabled={busy} onClick={() => onDraft(null)}>{m.noteCancel}</button><button type="submit" disabled={disabled || !!draft.conflict || !draft.name.trim() || [...draft.name.trim()].length > 80 || draft.kind !== 'rename' && draft.kind !== 'delete' && !draft.target}>{draft.kind === 'delete' ? m.noteDelete : m.noteSave}</button></div>
    </form> : null}
    {!active.length && bookmarks ? <p>{m.bookmarkEmpty}</p> : null}
    <div className="reader-bookmark-list">{active.map(bookmark => <article key={bookmark.id}>
      <h3>{bookmark.name}</h3><p>{bookmark.reanchorRequired || bookmark.documentRevision !== document.revision ? m.bookmarkNeedsPosition : position(bookmark)}</p>
      <div className="reader-note-actions"><button type="button" disabled={busy || !!draft || bookmark.reanchorRequired || bookmark.documentRevision !== document.revision} onClick={() => onJump(bookmark)}>{m.noteJump}</button>
        <button type="button" data-bookmark-id={bookmark.id} data-bookmark-action="rename" disabled={disabled || !!draft} onClick={() => onDraft({kind: 'rename', id: bookmark.id, name: bookmark.name, originalName: bookmark.name, baseVersion: bookmark.version, target: bookmark})}>{m.bookmarkRename}</button>
        <button type="button" data-bookmark-id={bookmark.id} data-bookmark-action="reanchor" disabled={disabled || !!draft} onClick={() => onDraft({kind: 'reanchor', id: bookmark.id, name: bookmark.name, originalName: bookmark.name, baseVersion: bookmark.version, target: null})}>{m.bookmarkReanchor}</button>
        <button type="button" data-bookmark-id={bookmark.id} data-bookmark-action="delete" disabled={disabled || !!draft} onClick={() => onDelete(bookmark)}>{m.noteDelete}</button></div>
    </article>)}</div>
  </section>;
}
