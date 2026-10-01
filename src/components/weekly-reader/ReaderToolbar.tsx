import type {ReaderZoom} from '@/features/weekly-reader/navigation';
import type {getMessages} from '@/i18n/messages';
export type ReaderMessages = ReturnType<typeof getMessages>['weeklyReader'];

export function ReaderToolbar({messages: m, zoom, setZoom}: {messages: ReaderMessages; zoom: ReaderZoom; setZoom: (zoom: ReaderZoom) => void}) {
  return <div className="reader-zoom-controls">
    <button type="button" aria-pressed={zoom === 'page'} onClick={() => setZoom('page')}>{m.fitPage}</button>
    <button type="button" aria-pressed={zoom === 'width'} onClick={() => setZoom('width')}>{m.fitWidth}</button>
    <label>{m.zoom}<select value={typeof zoom === 'number' ? String(zoom) : ''} onChange={event => setZoom(Number(event.target.value))}>
      <option value="" disabled>—</option>{[.75, 1, 1.25, 1.5, 2, 2.5].map(value => <option key={value} value={value}>{value * 100}%</option>)}
    </select></label>
  </div>;
}
