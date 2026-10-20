import {useEffect, useRef, useState} from 'react';
import {Button, Dialog} from '@hallelujahhomechurch/ui';
import type {usePrivateReader} from '@/features/weekly-reader/usePrivateReader';
import {buildNoteExport} from '@/features/weekly-reader/note-export';
import type {Locale} from '@/i18n/locales';
import type {ReaderMessages} from './ReaderToolbar';

type Snapshot = Awaited<ReturnType<ReturnType<typeof usePrivateReader>['prepareExport']>>;
export function NoteExportDialog({messages: m, locale, issueNumber, visibleIds, total, theme, prepare, current, onClose}: {
  messages: ReaderMessages; locale: Locale; issueNumber: number;
  visibleIds: string[]; total: number; theme: 'light' | 'dark'; prepare: (ids: string[] | null) => Promise<Snapshot>;
  current: () => boolean; onClose: () => void;
}) {
  const [filtered, setFiltered] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [handed, setHanded] = useState(false);
  const [ready, setReady] = useState<{snapshot: Snapshot; url: string; filename: string; missingQuotes: number} | null>(null);
  const working = useRef(false);
  const alive = useRef(false), url = useRef<string | null>(null);
  useEffect(() => {alive.current = true; return () => {alive.current = false; if (url.current) URL.revokeObjectURL(url.current);};}, []);
  function discard() {if (url.current) URL.revokeObjectURL(url.current); url.current = null; setReady(null); setHanded(false);}
  async function prepareFile() {
    if (working.current) return;
    working.current = true; discard(); setBusy(true); setError('');
    try {
      if (!current() || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function' || !('download' in globalThis.document.createElement('a'))) throw new Error('export_unsupported');
      const snapshot = await prepare(filtered ? visibleIds : null);
      if (!alive.current || !current()) throw new Error('export_changed');
      const file = await buildNoteExport({notes: snapshot.notes, locale, issueNumber, labels: {quote: m.exportQuote, note: m.exportOwnNote}});
      if (!alive.current || !current()) throw new Error('export_changed');
      url.current = URL.createObjectURL(new Blob([file.buffer], {type: file.mimeType}));
      setReady({snapshot, url: url.current, filename: file.filename, missingQuotes: file.missingQuotes});
    } catch (failure) {if (alive.current) setError(failure instanceof Error && failure.message === 'export_limit' ? m.exportLimit : m.exportUnavailable);}
    finally {working.current = false; if (alive.current) setBusy(false);}
  }
  async function download() {
    if (!ready || working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      await ready.snapshot.validate(() => {
        if (!alive.current || !current()) throw new Error('export_changed');
        if (navigator.userActivation?.isActive !== true) throw new Error('export_activation');
        const anchor = globalThis.document.createElement('a'); anchor.href = ready.url; anchor.download = ready.filename;
        globalThis.document.body.append(anchor);
        try {anchor.click();} finally {anchor.remove();}
        // Let the browser consume the URL even if this dialog or document closes.
        const handedURL = ready.url; setTimeout(() => URL.revokeObjectURL(handedURL), 60000);
        url.current = null; setReady(null); setHanded(true);
      });
    } catch (failure) {if (alive.current) setError(failure instanceof Error && failure.message === 'export_activation' ? m.exportActivation : m.exportChanged);}
    finally {working.current = false; if (alive.current) setBusy(false);}
  }
  return <Dialog isOpen title={m.exportNotes} closeLabel={m.close} onOpenChange={open => {if (!open) onClose();}}>
    <div className="reader-note-export" aria-busy={busy} ref={node => {const overlay = node?.closest<HTMLElement>('.hhc-modal-overlay'); if (overlay) {overlay.dataset.theme = theme; overlay.style.colorScheme = theme;}}}>
      <p>{m.exportPrivacy}</p><p>{m.exportDraftExcluded}</p>
      <fieldset disabled={busy}><legend>{m.exportScope}</legend>
        <label><input type="radio" name="note-export-scope" checked={!filtered} onChange={() => {discard(); setFiltered(false);}}/>{m.exportAll.replace('{count}', String(total))}</label>
        {visibleIds.length !== total ? <label><input type="radio" name="note-export-scope" checked={filtered} onChange={() => {discard(); setFiltered(true);}}/>{m.exportFiltered.replace('{count}', String(visibleIds.length))}</label> : null}
      </fieldset>
      {ready ? <div role="status"><p>{m.exportReady.replace('{count}', String(ready.snapshot.notes.length))}{ready.snapshot.local ? ` ${m.exportLocal}` : ''}</p>{ready.missingQuotes ? <p>{m.exportMissingQuote.replace('{count}', String(ready.missingQuotes))}</p> : null}</div> : null}
      {handed ? <p role="status">{m.exportHanded}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="reader-note-actions"><Button variant="secondary" onPress={onClose}>{m.noteCancel}</Button>
        {ready ? <><Button variant="secondary" isDisabled={busy} onPress={() => {void prepareFile();}}>{m.exportPrepare}</Button><Button isDisabled={busy} onPress={() => {void download();}}>{busy ? m.exportPreparing : m.exportDownload}</Button></> : <Button isDisabled={busy || !(filtered ? visibleIds.length : total)} onPress={() => {void prepareFile();}}>{busy ? m.exportPreparing : m.exportPrepare}</Button>}
      </div>
    </div>
  </Dialog>;
}
