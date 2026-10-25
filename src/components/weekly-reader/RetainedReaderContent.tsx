import {useState} from 'react';
import type {PendingReaderMutation} from '@/features/weekly-reader/offline-store';
import type {ReaderMessages} from './ReaderToolbar';

export function RetainedReaderContent({entries, messages: m, busy, onPosition}: {entries: readonly PendingReaderMutation[]; messages: ReaderMessages; busy: boolean; onPosition: (id: string) => Promise<void>}) {
  const [failed, setFailed] = useState(false);
  if (!entries.length) return null;
  return <section className="reader-notes-list"><h3>{m.retainedTitle}</h3><p>{m.retainedHelp}</p>
    {failed && <p role="alert">{m.actionFailed}</p>}
    {entries.map(entry => <article key={entry.mutation.mutationId}>
      <blockquote>{entry.sourceQuote}</blockquote>
      {(entry.mutation.kind === 'createNote' || entry.mutation.kind === 'editNote') && <p className="reader-note-text">{entry.mutation.payload.text}</p>}
      {(entry.mutation.kind === 'setHighlight' || entry.mutation.kind === 'restoreHighlight') && <p>{m[`${entry.mutation.payload.color}Highlight`]}</p>}
      <button type="button" disabled={busy} onClick={() => {setFailed(false); void onPosition(entry.mutation.mutationId).catch(() => setFailed(true));}}>{m.retainedPosition}</button>
    </article>)}
    <button type="button" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(entries.map(entry => ({revision: entry.mutation.documentRevision, original: entry.sourceQuote, createdAt: entry.mutation.createdAt, kind: entry.mutation.kind, content: entry.mutation.payload})), null, 2)], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = 'bulletin-retained-content.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }}>{m.retainedExport}</button>
  </section>;
}
