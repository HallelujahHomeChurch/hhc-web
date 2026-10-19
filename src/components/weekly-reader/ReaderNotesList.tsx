import {useState, useCallback, type ComponentProps} from 'react';
import {Tabs} from '@hallelujahhomechurch/ui';
import {BookmarksPanel} from './BookmarksPanel';
import {NotesPanel} from './NotesPanel';
import {HighlightsPanel} from './HighlightsPanel';
import {HighlightHistory, type HistoryDraft} from './HighlightHistory';
import type {ReaderMessages} from './ReaderToolbar';

const normalized = (text: string) => text.normalize('NFKC').toLowerCase();
type Props = {
  messages: ReaderMessages;
  filter: string[] | null;
  onClearFilter: () => void;
  notes: ComponentProps<typeof NotesPanel>;
  highlights: ComponentProps<typeof HighlightsPanel>;
  history: ComponentProps<typeof HighlightHistory>;
  onExport?: (visibleIds: string[]) => void;
  exportDisabled?: boolean;
  bookmarks?: ComponentProps<typeof BookmarksPanel>;
};

/** Display state only: filtering never changes a draft or submits a reader mutation. */
export function ReaderNotesList({messages: m, filter, onClearFilter, notes, highlights, history, onExport, exportDisabled, bookmarks}: Props) {
  const [tab, setTab] = useState(bookmarks?.draft ? 'bookmarks' : 'notes');
  const [noteQuery, setNoteQuery] = useState(''), [highlightQuery, setHighlightQuery] = useState('');
  const [color, setColor] = useState('all');
  const [historyDraft, setHistoryDraft] = useState<HistoryDraft | undefined>(undefined);
  const rememberHistory = useCallback((draft: HistoryDraft) => {setHistoryDraft(previous => JSON.stringify(previous) === JSON.stringify(draft) ? previous : draft);}, []);
  const query = normalized(noteQuery.trim());
  const visible = notes.notes.filter(note => !note.deleted && (!filter || filter.includes(note.id)) && (!query || normalized(`${note.text}\n${note.quote}`).includes(query)));
  const find = (label: string, value: string, update: (value: string) => void) => <label className="reader-private-search">{label}<input type="search" maxLength={256} value={value} onChange={event => update(event.target.value)}/></label>;
  return <div className="reader-notes-browser"><Tabs label={m.noteCategories} selectedKey={tab} onSelectionChange={key => {if (key !== 'notes') onClearFilter(); setTab(key);}} items={[
    {id: 'notes', label: m.notesTab, content: <>
      {onExport ? <button type="button" disabled={exportDisabled || !notes.notes.some(note => !note.deleted)} onClick={() => onExport(visible.map(note => note.id))}>{m.exportNotes}</button> : null}
      {find(m.searchNotes, noteQuery, setNoteQuery)}
      {filter ? <div className="reader-filter-row"><span>{m.currentPassage}</span><button type="button" onClick={onClearFilter}>{m.showAllNotes}</button></div> : null}
      <p className="reader-filter-count" role="status">{m.noteResultCount.replace('{count}', String(visible.length))}</p>
      {noteQuery ? <button type="button" onClick={() => setNoteQuery('')}>{m.clearSearch}</button> : null}
      <NotesPanel {...notes} notes={visible}/>
    </>},
    {id: 'highlights', label: m.highlightsTab, content: <>
      {find(m.searchHighlights, highlightQuery, setHighlightQuery)}
      <div className="reader-filter-colors" role="group" aria-label={m.highlightColors}>{(['all', 'yellow', 'red', 'blue'] as const).map(value => <button key={value} type="button" aria-pressed={color === value} onClick={() => setColor(value)}>{value === 'all' ? m.allColors : m[`${value}Highlight`]}</button>)}</div>
      {highlightQuery || color !== 'all' ? <button type="button" onClick={() => {setHighlightQuery(''); setColor('all');}}>{m.clearFilters}</button> : null}
      <HighlightsPanel {...highlights} query={highlightQuery} color={color}/>
    </>},
    ...(bookmarks ? [{id: 'bookmarks', label: m.bookmarksTab, content: <BookmarksPanel {...bookmarks}/>}]: []),
    {id: 'history', label: m.historyTab, content: <HighlightHistory {...history} initialDraft={historyDraft} onDraftChange={rememberHistory}/>}
  ]}/></div>;
}
