import {useEffect, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {NotebookPen} from 'lucide-react';
import {ReaderIconButton} from './ReaderIconButton';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';

export function NoteIndicators({root, notes, layoutKey, label, onOpen, mobile = false}: {
  root: RefObject<HTMLDivElement | null>; notes: readonly BulletinReaderNote[]; layoutKey: string;
  label: string; onOpen: (noteIds: string[], trigger: HTMLButtonElement) => void;
  mobile?: boolean;
}) {
  const [markers, setMarkers] = useState<{top: number; ids: string[]}[]>([]);
  const [rows, setRows] = useState<{host: HTMLDivElement; ids: string[]}[]>([]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (mobile) {
      const groups = new Map<HTMLElement, Set<string>>();
      const anchors = Array.from(element.querySelectorAll<HTMLElement>('[data-sentence-id]'));
      for (const note of notes.filter(note => !note.deleted)) {
        for (const anchor of anchors.filter(anchor => note.sentenceIds.includes(anchor.dataset.sentenceId!))) {
          const range = note.ranges?.find(range => range.sentenceId === anchor.dataset.sentenceId);
          if (range && (Number(anchor.dataset.fragmentStart) >= range.end || Number(anchor.dataset.fragmentEnd) <= range.start)) continue;
          const block = anchor.closest<HTMLElement>('[data-block-id]');
          const boundary = (block?.matches('p,h2,h3,li,blockquote') ? block : block?.closest<HTMLElement>('p,h2,h3,li,blockquote')) ?? anchor.closest<HTMLElement>('p,h2,h3,li,blockquote') ?? anchor.closest<HTMLElement>('[data-component-id]');
          if (!boundary || !element.contains(boundary) || boundary.parentElement?.closest('[data-sentence-id]')) continue;
          const ids = groups.get(boundary) ?? new Set<string>(); ids.add(note.id); groups.set(boundary, ids);
        }
      }
      const next = Array.from(groups, ([boundary, ids]) => {
        const host = document.createElement('div'); host.className = 'reader-note-row';
        boundary.insertAdjacentElement('afterend', host);
        return {host, ids: [...ids]};
      });
      const frame = requestAnimationFrame(() => setRows(next));
      return () => {cancelAnimationFrame(frame); for (const row of next) row.host.remove();};
    }
    const measure = () => {
      const origin = element.getBoundingClientRect().top;
      const anchors = Array.from(element.querySelectorAll<HTMLElement>('[data-sentence-id]'));
      const positions = notes.filter(note => !note.deleted).flatMap(note => {
        const anchor = note.sentenceIds.flatMap(id => anchors.filter(element => element.dataset.sentenceId === id)).find(element => {
          const range = note.ranges?.find(range => range.sentenceId === element.dataset.sentenceId);
          return !range || Number(element.dataset.fragmentStart) < range.end && Number(element.dataset.fragmentEnd) > range.start;
        });
        return anchor ? [{top: Math.max(0, anchor.getBoundingClientRect().top - origin), id: note.id}] : [];
      }).sort((a, b) => a.top - b.top);
      const grouped: {top: number; ids: string[]}[] = [];
      for (const position of positions) {
        const previous = grouped.at(-1);
        if (previous && position.top - previous.top < 44) previous.ids.push(position.id);
        else grouped.push({top: position.top, ids: [position.id]});
      }
      setMarkers(grouped);
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {cancelAnimationFrame(frame); observer?.disconnect();};
  }, [root, notes, layoutKey, mobile]);
  if (mobile) return rows.map((row, index) => createPortal(<ReaderIconButton variant="ghost" aria-label={`${label} (${row.ids.length})`} icon={<span className="reader-note-row-icon"><NotebookPen size={18} aria-hidden="true"/>{row.ids.length > 1 ? <small aria-hidden="true">{row.ids.length}</small> : null}</span>} onPress={event => onOpen(row.ids, event.target as HTMLButtonElement)}/>, row.host, String(index)));
  return markers.map(marker => <button type="button" key={marker.ids.join(':')} className="reader-note-indicator" style={{top: marker.top}} aria-label={`${label} (${marker.ids.length})`} onClick={event => onOpen(marker.ids, event.currentTarget)}><span aria-hidden="true">✎<small>{marker.ids.length > 1 ? marker.ids.length : ''}</small></span></button>);
}
