'use client';

import {useEffect} from 'react';
import {usePersistentPlayback} from './PlaybackProvider';
import {useBroadcastWatch} from './useBroadcastWatch';
import {useVodPlayback} from './useVodPlayback';
import {usePlaybackProgress} from './usePlaybackProgress';
import {usePlaybackTelemetry} from './usePlaybackTelemetry';
import {HlsPlayer, type PlayerLabels} from './HlsPlayer';
import type {PlayerBookmark} from './live-player';
import {useRecordingCover} from './RecordingCover';

type Props = Parameters<typeof useVodPlayback>[0] & {
  messages: PlayerLabels & {playError: string; expired: string; preparing: string; retry: string};
  onMinimize?: () => void;
  initialBookmark?: PlayerBookmark;
  previousHref?: string;
  nextHref?: string;
};

export function PersistentVod({previousHref, nextHref, initialBookmark, onMinimize, ...options}: Props) {
  const {selected, api, messages} = options;
  const controls = usePersistentPlayback();
  const id = controls?.inWatch ? undefined : selected?.id;
  const {watch, denied} = useBroadcastWatch(api, id, 0);
  const close = controls?.close;
  const key = controls?.activeKey;
  useEffect(() => {
    if (id && key && (denied || watch && (watch.view !== 'vod' || watch.recording?.packageId !== selected?.packageId))) close?.(key);
  }, [id, key, denied, watch, selected?.packageId, close]);
  const session = useVodPlayback(options);
  const {start, automaticAttempt, playback, media, playerSection} = session;
  const prepareProgress = usePlaybackProgress(api, selected?.id, selected?.packageId ? `vod:${selected.packageId}` : undefined, playerSection, media, Boolean(selected));
  const poster = useRecordingCover(api, selected?.id, selected?.expiresAt,
    selected?.selectedCoverId || (selected?.packageId ? `auto:${selected.packageId}` : undefined));
  useEffect(() => {
    if (selected && automaticAttempt.current !== selected.id) void start(initialBookmark, prepareProgress);
  }, [selected, automaticAttempt, start, initialBookmark, prepareProgress]);
  usePlaybackTelemetry(api, selected?.id, media, Boolean(playback));

  return <div ref={playerSection}>
    {selected && playback?.recordingId === selected.id
      ? <HlsPlayer key={`${playback.url}:${session.backgroundAudio}`} backgroundAudioUrl={session.audioUrl}
          playbackMediaRef={media} playbackPauseRef={session.playbackPause} resume={session.vodResume}
          poster={poster} videoRef={session.video} playbackUrl={playback.url}
          availableQualities={(playback.grant.renditions ?? []).map(rendition => rendition.name)}
          watermark={playback.grant.watermarkCode} title={selected.title} labels={messages}
          previousHref={previousHref} nextHref={nextHref} onMinimize={onMinimize} onPlayIntent={kind=>{void prepareProgress(kind);}} onError={session.mediaError} onBookmark={session.rememberVod}/>
      : <div className="grid aspect-video place-items-center bg-neutral-950 text-white">
          {session.playError
            ? <button type="button" onClick={() => void start(session.vodBookmark.current, prepareProgress)}>{messages.retry}</button>
            : <span role="status">{messages.preparing}</span>}
        </div>}
  </div>;
}
