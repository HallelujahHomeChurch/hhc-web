'use client';

import {useEffect, type ComponentProps} from 'react';
import {LiveRecordingPlayer} from './LiveRecordingPlayer';
import {usePersistentPlayback} from './PlaybackProvider';
import {useBroadcastWatch} from './useBroadcastWatch';

export function PersistentLive(props: ComponentProps<typeof LiveRecordingPlayer>) {
  const playback = usePersistentPlayback();
  const id = playback?.inWatch ? undefined : props.recording.id;
  const {watch, playbackEnded} = useBroadcastWatch(props.api, id, 0);
  const close = playback?.close;
  const key = playback?.activeKey;
  useEffect(() => {
    if (id && playbackEnded && key) close?.(key);
  }, [id, playbackEnded, key, close]);
  const latest = id && watch?.live?.captureId === props.recording.captureId ? watch.live : undefined;
  const mini = playback && !playback.inWatch ? {onExpand: playback.expand, expandLabel: playback.labels.expand, compact: playback.miniCompact} : undefined;
  if(id&&playbackEnded)return null;
  return <LiveRecordingPlayer verifyRevision={id&&watch?.view==='unavailable'?watch.stateRevision:undefined} {...props} surfaceOnly onMinimizeMove={playback?.setMinimizeOffset}
    mini={mini} recording={latest ?? props.recording}
    mediaOriginSeconds={latest ? watch?.mediaStartSeconds ?? props.mediaOriginSeconds : props.mediaOriginSeconds}
    onVod={id ? undefined : props.onVod}/>;
}
