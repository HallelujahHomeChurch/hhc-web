import {useState, type ComponentProps, type CSSProperties} from 'react';
import {Tabs} from '@hallelujahhomechurch/ui';
import {Download, Search, X} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import {BookmarksPanel} from './BookmarksPanel';
import {NotesPanel} from './NotesPanel';
import {HighlightsPanel} from './HighlightsPanel';
import type {ReaderMessages} from './ReaderToolbar';

const normalized = (text: string) => text.normalize('NFKC').toLowerCase();
type Props = {
  messages: ReaderMessages;
  filter: string[] | null;
  onClearFilter: () => void;
  notes: ComponentProps<typeof NotesPanel>;
  highlights: ComponentProps<typeof HighlightsPanel>;
  onExport?: (visibleIds: string[]) => void;
  exportDisabled?: boolean;
  bookmarks?: ComponentProps<typeof BookmarksPanel>;
};

/** Display state only: filtering never changes a draft or submits a reader mutation. */
export function ReaderNotesList({messages: m, filter, onClearFilter, notes, highlights, onExport, exportDisabled, bookmarks}: Props) {
  const [tab, setTab] = useState(bookmarks?.draft ? 'bookmarks' : 'notes');
  const [noteQuery, setNoteQuery] = useState(''), [highlightQuery, setHighlightQuery] = useState('');
  const query = normalized(noteQuery.trim());
  const visible = notes.notes.filter(note => !note.deleted && (!filter || filter.includes(note.id)) && (!query || normalized(`${note.text}\n${note.quote}`).includes(query)));
  const find = (label: string, value: string, update: (value: string) => void) => <div className="reader-private-search">
    <Search size={18} aria-hidden="true"/>
    <input type="search" aria-label={label} placeholder={label} maxLength={256} value={value} onChange={event => update(event.target.value)}/>
    {value ? <ReaderIconButton variant="ghost" aria-label={m.clearSearch} onPress={() => update('')} icon={<X size={18} aria-hidden="true"/>}/> : null}
  </div>;
  return <div className="reader-notes-browser" style={{'--reader-tab-count': bookmarks ? 3 : 2} as CSSProperties}><Tabs label={m.noteCategories} selectedKey={tab} onSelectionChange={key => {if (key !== 'notes') onClearFilter(); setTab(key);}} items={[
    {id: 'notes', label: m.notesTab, content: <>
      {find(m.searchNotes, noteQuery, setNoteQuery)}
      {filter ? <div className="reader-filter-row"><span>{m.currentPassage}</span><button type="button" onClick={onClearFilter}>{m.showAllNotes}</button></div> : null}
      <div className="reader-notes-tools">
        <p className="reader-filter-count" role="status">{m.noteResultCount.replace('{count}', String(visible.length))}</p>
        {onExport ? <ReaderIconButton variant="ghost" aria-label={m.exportNotes} isDisabled={exportDisabled || !notes.notes.some(note => !note.deleted)} onPress={() => onExport(visible.map(note => note.id))} icon={<Download size={18} aria-hidden="true"/>}/> : null}
      </div>
      <NotesPanel {...notes} notes={visible}/>
    </>},
    {id: 'highlights', label: m.highlightsTab, content: <>
      {find(m.searchHighlights, highlightQuery, setHighlightQuery)}
      <HighlightsPanel {...highlights} query={highlightQuery}/>
    </>},
    ...(bookmarks ? [{id: 'bookmarks', label: m.bookmarksTab, content: <BookmarksPanel {...bookmarks}/>}]: [])
  ]}/></div>;
}
