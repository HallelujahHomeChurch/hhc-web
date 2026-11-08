import type {RecordingProgressClaim, RecordingProgressOwner, RecordingProgressRead, RecordingProgressUpdate} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';

export type ProgressAPI = Pick<ReturnType<typeof createMemberVideoApi>, 'progress' | 'claimProgress' | 'saveProgress'>;
type Intent = {snapshot: RecordingProgressRead; kind: RecordingProgressClaim['startKind']};
const statusOf = (error: unknown) => (error as {status?: number} | null)?.status;

function deadline(signals: readonly AbortSignal[], ms: number) {
  const controller = new AbortController();
  let finish!: () => void;
  const canceled = new Promise<undefined>(resolve => { finish = () => resolve(undefined); });
  const cancel = () => { controller.abort(); finish(); };
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; cancel(); }, ms);
  for (const signal of new Set(signals)) {
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, {once: true});
  }
  return {
    signal: controller.signal,
    canceled,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timer);
      for (const signal of new Set(signals)) signal.removeEventListener('abort', cancel);
    },
  };
}

export function createPlaybackProgress(api: ProgressAPI, id: string, version: string, signal: AbortSignal) {
  const sessionId = crypto.randomUUID();
  let currentVersion = version;
  let observedGeneration: string | undefined;
  let intent: Intent | undefined;
  let owner: RecordingProgressOwner | undefined;
  let sequence = 0;
  let writing = false;
  let next: {positionSeconds: number; state: RecordingProgressUpdate['state']} | undefined;
  let retryAt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let acknowledged: Pick<RecordingProgressUpdate, 'positionSeconds' | 'state'> | undefined;
  signal.addEventListener('abort', () => clearTimeout(retryTimer), {once: true});
  let attempt = 0;
  let preparing = false;
  let claiming = false;
  let pendingPosition: number | undefined;
  let intentRevision = 0;

  const drain = async () => {
    if (writing || claiming || !owner || !next || signal.aborted || Date.now() < retryAt) return;
    const update = next;
    next = undefined;
    if (acknowledged?.positionSeconds === update.positionSeconds && acknowledged.state === update.state) return;
    writing = true;
    const writingOwner = owner;
    try {
      await api.saveProgress(id, {
        sessionId, generation: owner.generation, mediaVersion: owner.mediaVersion,
        sequence: ++sequence, positionSeconds: update.positionSeconds, state: update.state,
      }, {signal});
      if (owner === writingOwner) acknowledged = update;
      attempt = 0;
    } catch (error) {
      const status = statusOf(error);
      if (owner !== writingOwner) return;
      if (status && [401, 403, 404, 409, 412, 428].includes(status)) {
        owner = undefined;
        next = undefined;
      } else {
        const retryAfter = (error as {retryAfter?: string} | null)?.retryAfter;
        const seconds = Number(retryAfter);
        const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter ?? '') - Date.now();
        retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : [5000, 10000, 20000, 30000][Math.min(attempt++, 3)]);
        next ??= update;
        clearTimeout(retryTimer);
        if (!signal.aborted) retryTimer = setTimeout(() => void drain(), Math.max(0, retryAt - Date.now()));
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
    claiming = true;
    owner = undefined;
    next = undefined;
    const claim = {
      sessionId, claimId: crypto.randomUUID(), expectedGeneration: snapshot.progress?.generation ?? null,
      claimToken: snapshot.claimToken, mediaVersion: snapshot.mediaVersion, startKind: kind, observedPositionSeconds: position,
    };
    try {
      for (const delay of [0, 5000, 10000, 20000]) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (revision !== intentRevision || signal.aborted || (delay && !navigator.onLine)) return;
        const timeout = deadline([signal], 4000);
        try {
          const claimed = await Promise.race([api.claimProgress(id, claim, timeout.signal), timeout.canceled]);
          if (!claimed) {
            if (timeout.timedOut()) continue;
            return;
          }
          if (revision !== intentRevision || signal.aborted) return;
          owner = claimed;
          sequence = claimed.sequence;
          acknowledged = undefined;
          clearTimeout(retryTimer);
          attempt = 0;
          retryAt = 0;
          return;
        } catch {
          // A timeout can hide an accepted claim. Replay only the original intent.
          if (!timeout.timedOut()) return;
        } finally { timeout.dispose(); }
      }
    } finally {
      if (revision === intentRevision) {
        claiming = false;
        if (!signal.aborted) void drain();
      }
    }
  }

  return {
    ownsProgress: () => Boolean(owner),
    identity: () => ({recordingId: id, mediaVersion: currentVersion, sessionId, generation: owner?.generation ?? observedGeneration}),
    async prepare(kind: Intent['kind'], startSignal: AbortSignal = signal) {
      const revision = ++intentRevision;
      intent = undefined;
      claiming = false;
      next = undefined;
      pendingPosition = undefined;
      preparing = true;
      const timeout = deadline([signal, startSignal], 1500);
      try {
        const snapshot = await Promise.race([api.progress(id, timeout.signal), timeout.canceled]);
        if (!snapshot || revision !== intentRevision || signal.aborted || startSignal.aborted ||
          (snapshot.mediaVersion !== version && !snapshot.mediaVersion.startsWith(`${version}:`))) return;
        currentVersion = snapshot.mediaVersion;
        observedGeneration = snapshot.progress?.mediaVersion === snapshot.mediaVersion ? snapshot.progress.generation : undefined;
        intent = {snapshot, kind};
        if (kind === 'resume' && !snapshot.progress?.completed && version.startsWith('vod:')) return snapshot.progress?.positionSeconds;
      } catch { /* Playback authorization remains independent of progress availability. */ }
      finally {
        timeout.dispose();
        if (revision === intentRevision) {
          preparing = false;
          if (pendingPosition !== undefined) void playing(pendingPosition);
        }
      }
    },
    playing,
    save(positionSeconds: number, state: RecordingProgressUpdate['state']) {
      if ((!owner && !claiming) || signal.aborted || !Number.isFinite(positionSeconds) || positionSeconds < 0) return;
      next = {positionSeconds, state};
      return drain();
    },
    flush(positionSeconds: number, state: RecordingProgressUpdate['state']) {
      if (!owner || !Number.isFinite(positionSeconds) || positionSeconds < 0 || signal.aborted || Date.now() < retryAt ||
        (!writing && acknowledged?.positionSeconds === positionSeconds && acknowledged.state === state)) return;
      const writingOwner = owner;
      next = undefined;
      // A terminal keepalive can outlive an older request. Its newer sequence fences that request.
      void api.saveProgress(id, {
        sessionId, generation: owner.generation, mediaVersion: owner.mediaVersion,
        sequence: ++sequence, positionSeconds, state,
      }, {keepalive: true}).catch(error => {
        if (owner === writingOwner && statusOf(error) === 409) owner = undefined;
      });
    },
  };
}
