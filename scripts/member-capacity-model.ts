export const weights = {bulletin_catalog: 15, reader_open: 15, reader_sync: 20, media_catalog: 15, media_play: 20, account_read: 10, pdf_download: 5} as const;
export type Operation = keyof typeof weights;
export type Sample = {kind: 'operation' | 'request' | 'background'; name: string; flow: number; startMs: number; durationMs: number; ok: boolean; status?: number; bytes?: number; firstByteMs?: number; error?: 'timeout' | 'network' | 'aborted' | 'http' | 'validation'};

export function errorCategory(error: unknown): Sample['error'] {
  return error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' :
    error instanceof DOMException && error.name === 'AbortError' || typeof error === 'string' ? 'aborted' :
      error instanceof TypeError ? 'network' : 'validation';
}

export function sloReason(samples: readonly Sample[], minimum = 1000) {
  if (samples.length < minimum) return null;
  const summary = summarize(samples);
  if (summary.errors / summary.attempts > .005) return 'error_rate';
  // Capacity exploration records latency; the coordinator evaluates sustained degradation against prior stages.
  return null;
}

export function requestMetricName(url: URL, method: string, family: string) {
  if (['account.read', 'account.token', 'recording.read'].includes(family)) return family + '.' + url.pathname.split('/').at(-1);
  if (family === 'media.cookie') return family + '.' + method.toLowerCase();
  return family;
}

export function isBulkTransfer(name: string) {
  return ['pdf.file', 'media.segment', 'media.playlist', 'recording.read.cover'].includes(name);
}

export function isApiSample(sample: Sample) {
  return sample.kind === 'request' && !isBulkTransfer(sample.name);
}

export function randomSequence(flow: number, seed = 20261029) {
  let state = (seed ^ Math.imul(flow + 1, 0x9e3779b1)) >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function operationDeck(random: () => number): Operation[] {
  const deck = (Object.entries(weights) as [Operation, number][]).flatMap(([op, count]) => Array<Operation>(count).fill(op));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function summarize(samples: readonly Sample[]) {
  const durations = samples.map(s => s.durationMs).sort((a, b) => a - b);
  const percentile = (p: number) => durations.length ? durations[Math.ceil(p * durations.length) - 1] : null;
  return {attempts: samples.length, errors: samples.filter(s => !s.ok).length, p95Ms: percentile(.95), p99Ms: percentile(.99)};
}

// Only fixed route families leave the browser; credentials and target IDs do not.
export function requestFamily(url: URL, method: string, origin: string) {
  const path = url.pathname;
  if (url.username || url.password || url.hash) throw new Error('request_boundary');
  if (url.origin === origin) {
    const routes: [string, RegExp, string][] = [
      ['GET', /^\/api\/account\/v1\/(session|csrf-token)$/, 'account.read'],
      ['POST', /^\/api\/account\/v1\/(session\/access-token|refresh)$/, 'account.token'],
      ['GET', /^\/api\/member\/bulletins\/online$/, 'bulletin.discovery'],
      ['POST', /^\/api\/member\/bulletins\/[\da-f-]{36}\/versions\/(zh-Hant|zh-Hans|en)\/online\/access$/, 'reader.access'],
      ['GET', /^\/api\/member\/bulletins\/[\da-f-]{36}\/versions\/(zh-Hant|zh-Hans|en)\/online\/reader\/state$/, 'reader.state'],
      ['POST', /^\/api\/member\/bulletins\/[\da-f-]{36}\/versions\/(zh-Hant|zh-Hans|en)\/online\/reader\/mutations$/, 'reader.mutations'],
      ['POST', /^\/api\/member\/bulletin-download-jobs$/, 'pdf.create'],
      ['GET', /^\/api\/member\/bulletin-download-jobs\/[\da-f-]{36}$/, 'pdf.status'],
      ['GET', /^\/api\/member\/bulletin-download-jobs\/[\da-f-]{36}\/file$/, 'pdf.file'],
      ['GET', /^\/api\/member\/recordings$/, 'recording.list'],
      ['GET', /^\/api\/member\/recordings\/[\da-f-]{36}\/(watch|cover|interactions|metrics|comments)$/, 'recording.read'],
      ['POST', /^\/api\/member\/recordings\/[\da-f-]{36}\/playback$/, 'recording.grant'],
      ['POST', /^\/api\/member\/recordings\/[\da-f-]{36}\/heartbeat$/, 'recording.heartbeat'],
    ];
    const found = routes.find(([verb, pattern]) => verb === method && pattern.test(path));
    if (found) return found[2];
  }
  if (url.origin === 'https://media.alive.org.tw' && !url.search && /^\/videos\/[\w-]{1,80}\/packages\/[a-f0-9]{32}\/sessions\/[\w-]{1,80}\//.test(path)) {
    if (path.endsWith('/cookie') && ['POST', 'DELETE'].includes(method)) return 'media.cookie';
    if (method === 'GET') return path.endsWith('.m3u8') ? 'media.playlist' : 'media.segment';
  }
  throw new Error('request_boundary');
}

export type Gate = {scopeHash: string; observedAt: number; deadline: number; ready: boolean};
export function gateValid(gate: Gate, scopeHash: string, now: number) {
  return gate.ready && gate.scopeHash === scopeHash && /^[a-f0-9]{64}$/.test(scopeHash) &&
    now >= gate.observedAt && now - gate.observedAt <= 10000 && now < gate.deadline;
}
