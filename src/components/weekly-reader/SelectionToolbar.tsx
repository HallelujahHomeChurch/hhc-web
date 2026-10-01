import type {RefObject} from 'react';
import type {BulletinReaderHighlightColor} from '@hallelujahhomechurch/hhc-web-client';
import type {ReaderMessages} from './ReaderToolbar';

type Props = {
  messages: ReaderMessages; count: number; color: BulletinReaderHighlightColor | null;
  busy?: boolean; noteOpen?: boolean; noteButtonRef?: RefObject<HTMLButtonElement | null>;
  onColor: (color: BulletinReaderHighlightColor) => void; onClear: () => void; onCopy: () => void; onNote: () => void;
};
export function SelectionToolbar({messages: m, count, color, busy, noteOpen, noteButtonRef, onColor, onClear, onCopy, onNote}: Props) {
  if (!count || noteOpen) return null;
  return <div className="reader-selection-tools">
    <p role="status" className="reader-selection-count">{m.selectionCount.replace('{count}', String(count))}</p>
    <div className="reader-selection-actions" role="group" aria-label={m.selectionActions}>
      <div className="reader-color-group" role="group" aria-label={m.highlightColors}>
        {(['yellow', 'red', 'blue'] as const).map(value => <button key={value} type="button" className="reader-color" disabled={busy} aria-label={m[`${value}Highlight`]} title={m[`${value}Highlight`]} aria-pressed={color === value} onClick={() => onColor(value)}><span aria-hidden="true" data-color={value}/></button>)}
      </div>
      <button type="button" disabled={busy} onClick={onClear}>{m.clearHighlight}</button>
      <button type="button" onClick={onCopy}>{m.copySelection}</button>
      <button ref={noteButtonRef} type="button" disabled={busy} onClick={onNote}>{m.addNote}</button>
    </div>
  </div>;
}
