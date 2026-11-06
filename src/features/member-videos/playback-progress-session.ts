import type {RecordingProgressClaim, RecordingProgressOwner, RecordingProgressRead, RecordingProgressUpdate} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';

export type ProgressAPI = Pick<ReturnType<typeof createMemberVideoApi>, 'progress' | 'claimProgress' | 'saveProgress'>;
type Intent = {snapshot: RecordingProgressRead; kind: RecordingProgressClaim['startKind']};
const statusOf = (error: unknown) => (error as {status?: number} | null)?.status;

export function createPlaybackProgress(api: ProgressAPI, id: string, version: string, signal: AbortSignal) {
  const sessionId = crypto.randomUUID();
  let intent: Intent | undefined;
  let owner: RecordingProgressOwner | undefined;
  let sequence = 0;
  let writing = false;
  let next: {positionSeconds: number; state: RecordingProgressUpdate['state']; keepalive: boolean} | undefined;
  let retryAt = 0;
  let attempt = 0;
  let preparing = false;
  let pendingPosition: number | undefined;
  let intentRevision = 0;

  const drain = async () => {
    if (writing || !owner || !next || signal.aborted || Date.now() < retryAt) return;
    const update = next;
    next = undefined;
    writing = true;
    const writingOwner = owner;
    try {
      await api.saveProgress(id, {
        sessionId, generation: owner.generation, mediaVersion: owner.mediaVersion,
        sequence: ++sequence, positionSeconds: update.positionSeconds, state: update.state,
      }, update.keepalive ? {keepalive: true} : {signal});
      attempt = 0;
    } catch (error) {
      const status = statusOf(error);
      if (owner !== writingOwner) return;
      if (status && [401, 403, 404, 409, 412, 428].includes(status)) {
        owner = undefined;
        next = undefined;
      } else {
        const delay = Number((error as {retryAfter?: string} | null)?.retryAfter);
        retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay * 1000 : [5000, 10000, 20000, 30000][Math.min(attempt++, 3)]);
        next ??= update;
      }
    } finally {
      writing = false;
      if (next && owner && Date.now() >= retryAt) void drain();
    }
  };

  async function playing(position: number) {
    if (!Number.isFinite(position) || position < 0 || signal.aborted) return;
    if (preparing) { pendingPosition ??= position; return; }
    if (!intent) return;
    const {snapshot, kind} = intent;
    const revision = intentRevision;
    intent = undefined;
    const claim = {
      sessionId, claimId: crypto.randomUUID(), expectedGeneration: snapshot.progress?.generation ?? null,
      claimToken: snapshot.claimToken, mediaVersion: snapshot.mediaVersion, startKind: kind, observedPositionSeconds: position,
    };
    for (const delay of [0, 5000, 10000, 20000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (revision !== intentRevision || signal.aborted || (delay && !navigator.onLine)) return;
      const timeout = AbortSignal.timeout(4000);
      try {
        const claimed = await api.claimProgress(id, claim, AbortSignal.any([signal, timeout]));
        if (revision !== intentRevision || signal.aborted) return;
        owner = claimed;
        sequence = claimed.sequence;
        next = undefined;
        attempt = 0;
        retryAt = 0;
        return;
      } catch {
        // A timeout can hide an accepted claim. Replay only the original intent.
        if (!timeout.aborted) return;
      }
    }
  }

  return {
    async prepare(kind: Intent['kind'], startSignal: AbortSignal = signal) {
      const revision = ++intentRevision;
      intent = undefined;
      pendingPosition = undefined;
      preparing = true;
      try {
        const snapshot = await api.progress(id, AbortSignal.any([signal, startSignal, AbortSignal.timeout(1500)]));
        if (revision !== intentRevision || signal.aborted || startSignal.aborted ||
          (snapshot.mediaVersion !== version && !snapshot.mediaVersion.startsWith(`${version}:`))) return;
        intent = {snapshot, kind};
        if (kind === 'resume' && !snapshot.progress?.completed && version.startsWith('vod:')) return snapshot.progress?.positionSeconds;
      } catch { /* Playback authorization remains independent of progress availability. */ }
      finally {
        if (revision === intentRevision) {
          preparing = false;
          if (pendingPosition !== undefined) void playing(pendingPosition);
        }
      }
    },
    playing,
    save(positionSeconds: number, state: RecordingProgressUpdate['state'], keepalive = false) {
      if (!owner || !Number.isFinite(positionSeconds) || positionSeconds < 0) return;
      next = {positionSeconds, state, keepalive};
      return drain();
    },
  };
}

