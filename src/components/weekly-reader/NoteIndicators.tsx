import {useEffect, useState, type RefObject} from 'react';
import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';

export function NoteIndicators({root, notes, layoutKey, label, onOpen}: {
  root: RefObject<HTMLDivElement | null>; notes: readonly BulletinReaderNote[]; layoutKey: string;
  label: string; onOpen: (noteIds: string[]) => void;
}) {
  const [markers, setMarkers] = useState<{top: number; ids: string[]}[]>([]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const origin = element.getBoundingClientRect().top;
      const anchors = new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-sentence-id]')).map(sentence => [sentence.dataset.sentenceId!, sentence]));
      const positions = notes.filter(note => !note.deleted).flatMap(note => {
        const anchor = note.sentenceIds.map(id => anchors.get(id)).find(Boolean);
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
  }, [root, notes, layoutKey]);
  return markers.map(marker => <button type="button" key={marker.ids.join(':')} className="reader-note-indicator" style={{top: marker.top}} aria-label={`${label} (${marker.ids.length})`} onClick={() => onOpen(marker.ids)}><span aria-hidden="true">✎<small>{marker.ids.length > 1 ? marker.ids.length : ''}</small></span></button>);
}
