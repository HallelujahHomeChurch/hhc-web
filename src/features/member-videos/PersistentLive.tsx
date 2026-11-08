'use client';

import {useEffect, type ComponentProps} from 'react';
import {LiveRecordingPlayer} from './LiveRecordingPlayer';
import {usePersistentPlayback} from './PlaybackProvider';
import {useBroadcastWatch} from './useBroadcastWatch';

export function PersistentLive(props: ComponentProps<typeof LiveRecordingPlayer>) {
  const playback = usePersistentPlayback();
  const id = playback?.inWatch ? undefined : props.recording.id;
  const {watch, denied} = useBroadcastWatch(props.api, id, 0);
  const close = playback?.close;
  const key = playback?.activeKey;
  useEffect(() => {
    if (id && denied && key) close?.(key);
  }, [id, denied, key, close]);
  const latest = id && watch?.live?.captureId === props.recording.captureId ? watch.live : undefined;
  // shortcut: compact requires UI #224; publish and pin that package before merging this consumer.
  const mini = playback && !playback.inWatch ? {onExpand: playback.expand, expandLabel: playback.labels.expand, compact: playback.miniCompact} : undefined;
  return <LiveRecordingPlayer {...props} surfaceOnly onMinimizeMove={playback?.setMinimizeOffset}
    mini={mini} recording={latest ?? props.recording}
    mediaOriginSeconds={latest ? watch?.mediaStartSeconds ?? props.mediaOriginSeconds : props.mediaOriginSeconds}
    onVod={id ? undefined : props.onVod}/>;
}
