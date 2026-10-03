import type {ReaderZoom} from '@/features/weekly-reader/navigation';
import type {getMessages} from '@/i18n/messages';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import {Minus, Plus} from 'lucide-react';
export type ReaderMessages = ReturnType<typeof getMessages>['weeklyReader'];

export function ReaderToolbar({messages: m, zoom, setZoom}: {messages: ReaderMessages; zoom: ReaderZoom; setZoom: (zoom: ReaderZoom) => void}) {
  return <div className="reader-zoom-controls" role="group" aria-label={m.zoom}>
    <IconButton variant="ghost" aria-label={m.zoomOut} title={m.zoomOut} isDisabled={zoom <= 1} onPress={() => setZoom(zoom - .25)} icon={<Minus size={18} aria-hidden="true"/>}/>
    <output aria-label={m.zoom}>{Math.round(zoom * 100)}%</output>
    <IconButton variant="ghost" aria-label={m.zoomIn} title={m.zoomIn} isDisabled={zoom >= 4} onPress={() => setZoom(zoom + .25)} icon={<Plus size={18} aria-hidden="true"/>}/>
  </div>;
}
