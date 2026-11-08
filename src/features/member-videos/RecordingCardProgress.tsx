import {useSyncExternalStore} from 'react';
import type {MemberRecordingCard} from '@hallelujahhomechurch/hhc-web-client';
import {usePersistentPlayback} from './PlaybackProvider';
import {playerClock} from './PlayerChrome';
import styles from './MemberVideoZone.module.css';

export function RecordingCardProgress({item,label}:{item:MemberRecordingCard;label:string}) {
 const store = usePersistentPlayback()?.cardProgress;
 // Only the list can supply the current authoritative package/range version.
 const version = 'playbackMediaVersion' in item
  ? typeof item.playbackMediaVersion === 'string' ? item.playbackMediaVersion : undefined
  : item.playbackProgress?.mediaVersion;
 const local = useSyncExternalStore(store?.subscribe ?? (()=>()=>{}),()=>store?.get(item.id,version) ?? null,()=>null);
 const progress = local ?? (item.playbackProgress?.mediaVersion === version ? item.playbackProgress : null), duration = item.durationSeconds;
 if (!progress || !duration || duration <= 0 || !Number.isFinite(progress.positionSeconds)) return null;
 return <progress className={styles.cardProgress} max={100}
   value={progress.completed ? 100 : Math.max(0,Math.min(100,progress.positionSeconds/duration*100))}
   aria-label={`${item.title} — ${label}`} aria-valuetext={`${playerClock(progress.completed ? duration : progress.positionSeconds)} / ${playerClock(duration)}`}/>;
}
