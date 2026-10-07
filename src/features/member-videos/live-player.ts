export type PlaybackIntent = 'followLive' | 'dvr';
export type PlayerBookmark = {time: number; paused: boolean; rate: number; quality: 'auto' | '480p' | '720p' | '1080p'; intent: PlaybackIntent};
export type LivePlayerState = {verifiedEnd: number; canFollow: boolean; label: string; backToLive: string};

// seekable describes the EVENT timeline; buffered only describes cached bytes.
export function liveWindow(seekable: TimeRanges, verifiedEnd: number) {
  if (!seekable.length || !Number.isFinite(verifiedEnd) || verifiedEnd <= 0) return null;
  const start = seekable.start(0), end = Math.min(seekable.end(seekable.length - 1), verifiedEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {start, end, edge: Math.max(start, end - 30)};
}
