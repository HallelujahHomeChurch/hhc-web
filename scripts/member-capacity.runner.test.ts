import {afterEach, expect, it, vi} from 'vitest';
const fake = vi.hoisted(() => ({
  account: {getSession: vi.fn()}, auth: {start: vi.fn(), getAccessToken: vi.fn(), refreshAfterUnauthorized: vi.fn(), dispose: vi.fn()},
  client: {listOnlineBulletinDiscovery: vi.fn(), createBulletinDownloadJob: vi.fn(), getBulletinDownloadJob: vi.fn()},
  reader: {open: vi.fn(), privateState: vi.fn(), mutate: vi.fn()},
  media: {listPage: vi.fn(), watch: vi.fn(), cover: vi.fn(), interactions: vi.fn(), metrics: vi.fn(), comments: vi.fn(), grant: vi.fn(), exchange: vi.fn(), clear: vi.fn(), heartbeat: vi.fn()},
}));
vi.mock('@hallelujahhomechurch/account-client', () => ({createAccountSessionClient: () => fake.account, createBrowserAccountAuthRuntime: () => fake.auth}));
vi.mock('@hallelujahhomechurch/hhc-web-client', () => ({createHhcWebClient: () => fake.client}));
vi.mock('../src/features/weekly-reader/api', () => ({createReaderApi: () => fake.reader}));
vi.mock('../src/features/weekly-reader/bookmarks', () => ({bookmarkTargets: () => [{sentenceId: 's0', offset: 0, pageId: 'p0'}]}));
vi.mock('../src/features/member-videos/api', () => ({createMemberVideoApi: () => fake.media}));
import {startMemberCapacity} from './member-capacity';
const issueId = '00000000-0000-4000-8000-000000000001', recordingId = '00000000-0000-4000-8000-000000000002';
const root = `https://media.alive.org.tw/videos/${recordingId}/packages/${'a'.repeat(32)}/sessions/00000000-0000-4000-8000-000000000003/`;
const hash = 'a'.repeat(64);
function options() {
  return {runId: 'offline-fixture', scopeHash: hash, gate: {scopeHash: hash, observedAt: Date.now(), deadline: Date.now() + 300000, ready: true}, flows: 1, seconds: 120, mode: 'baseline' as const, issues: [{issueId, issueNumber: 1744, writable: true}], recordings: [{id: recordingId, analyticsApproved: true}], remainingRequests: 2000, remainingBytes: 10 * 1024 ** 2};
}
function setup(status = 200) {
  vi.useFakeTimers({toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']});
  vi.stubGlobal('location', {origin: 'https://www.alive.org.tw'});
  fake.account.getSession.mockResolvedValue({authenticated: true, user: {id: 'synthetic-account'}});
  fake.auth.start.mockResolvedValue({status: 'authenticated'}); fake.auth.getAccessToken.mockResolvedValue('synthetic-token');
  fake.reader.open.mockResolvedValue({document: {issueId, revision: 1}});
  const cloud = {bookmarks: [] as {id: string; version: number; deleted: boolean}[], notes: [] as {id: string; version: number; deleted: boolean}[], progress: null as {recordedAt: string} | null};
  fake.reader.privateState.mockImplementation(async () => ({state: structuredClone(cloud)}));
  fake.reader.mutate.mockImplementation(async (_selector, _document, mutations) => {
    const m = mutations[0];
    if (m.kind === 'createBookmark') cloud.bookmarks.push({id: m.payload.bookmarkId, version: 1, deleted: false});
    if (m.kind === 'deleteBookmark') cloud.bookmarks.find(b => b.id === m.payload.bookmarkId)!.deleted = true;
    if (m.kind === 'createNote') cloud.notes.push({id: m.payload.noteId, version: 1, deleted: false});
    if (m.kind === 'deleteNote') cloud.notes.find(n => n.id === m.payload.noteId)!.deleted = true;
    if (m.kind === 'setProgress') cloud.progress = m.payload.pageId ? {recordedAt: m.createdAt} : null;
    return {state: structuredClone(cloud), results: mutations.map((m: {mutationId: string}) => ({mutationId: m.mutationId, status: 'applied'}))};
  });
  fake.media.grant.mockResolvedValue({expiresAt: new Date(Date.now() + 3600000).toISOString()});
  fake.media.listPage.mockResolvedValue({items: [], nextCursor: null});
  fake.media.exchange.mockResolvedValue(root + 'master.m3u8');
  fake.client.createBulletinDownloadJob.mockResolvedValue({id: issueId, operationProgress: {status: 'ready'}});
  for (const fn of [fake.media.clear, fake.media.heartbeat, fake.media.watch, fake.media.cover, fake.media.interactions, fake.media.metrics, fake.media.comments]) fn.mockResolvedValue(undefined);
  const fetcher = vi.fn(async (request: Request) => new Response(request.url.includes('/file?') ? '%PDF-complete synthetic document' : request.url.endsWith('master.m3u8') ? '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720p/index.m3u8' : request.url.endsWith('index.m3u8') ? '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n' + Array.from({length: 30}, (_, i) => `#EXTINF:5,\nseg-${i}.m4s`).join('\n') + '\n#EXT-X-ENDLIST' : 'complete segment bytes', {status}));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
function keepGate(load: Awaited<ReturnType<typeof startMemberCapacity>>) {
  return setInterval(() => load.updateGate({scopeHash: hash, observedAt: Date.now(), deadline: Date.now() + 300000, ready: true}), 1000);
}
afterEach(() => {vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks();});

it('is inert until explicit invocation and rejects an absent safety gate before auth/network', async () => {
  const fetcher = setup();
  await expect(startMemberCapacity({...options(), gate: {...options().gate, ready: false}})).rejects.toThrow();
  expect(fake.account.getSession).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});
it('covers every baseline operation, drains real bodies, paces media, and exports no credentials or target IDs', async () => {
  const fetcher = setup(); const load = await startMemberCapacity(options()), timer = keepGate(load);
  await vi.advanceTimersByTimeAsync(100000); await load.done; clearInterval(timer);
  expect(load.snapshot()).toMatchObject({finished: true, reason: null, active: 0, playing: 0, overall: {attempts: 12, errors: 0}});
  expect(Object.keys(load.snapshot().operations)).toHaveLength(12);
  expect(fake.reader.mutate).toHaveBeenCalledTimes(6); expect(fake.media.clear).toHaveBeenCalledExactlyOnceWith(root + 'master.m3u8');
  expect(fake.media.heartbeat).toHaveBeenCalled(); expect(fetcher.mock.calls.length).toBeGreaterThan(8);
  const evidence = JSON.stringify({summary: load.snapshot(), samples: load.evidence()});
  for (const secret of ['synthetic-token', 'synthetic-account', recordingId, issueId, root, '%PDF-']) expect(evidence).not.toContain(secret);
});
it('stops new work when the external gate goes stale and retains failed attempt evidence', async () => {
  setup(); const load = await startMemberCapacity(options());
  await vi.advanceTimersByTimeAsync(11001); await load.done;
  expect(load.snapshot()).toMatchObject({reason: 'safety_gate', finished: true, active: 0, playing: 0});
  expect(fake.media.clear).toHaveBeenCalledOnce(); expect(fake.client.createBulletinDownloadJob).not.toHaveBeenCalled();
});
it('retains 429 in request and operation error accounting and does not retry', async () => {
  const fetcher = setup(429); const load = await startMemberCapacity(options());
  await vi.advanceTimersByTimeAsync(1); await load.done;
  expect(load.snapshot()).toMatchObject({reason: 'rate_limit_429', finished: true, overall: {errors: 1}});
  expect(load.evidence().filter(s => s.kind === 'request')).toMatchObject([{status: 429, ok: false}]);
  expect(fetcher).toHaveBeenCalledOnce();
});
it('operator cancellation drains scopes and prevents subsequent operations', async () => {
  const fetcher = setup(); const load = await startMemberCapacity(options());
  await vi.advanceTimersByTimeAsync(1); load.stop(); await load.done;
  const count = fetcher.mock.calls.length; await vi.advanceTimersByTimeAsync(30000);
  expect(load.snapshot()).toMatchObject({reason: 'operator', finished: true, active: 0, playing: 0});
  expect(fetcher).toHaveBeenCalledTimes(count); expect(fake.media.clear).toHaveBeenCalledOnce();
});
it('fails closed on a byte budget and never labels partial response data as success', async () => {
  setup(); const load = await startMemberCapacity({...options(), remainingBytes: 8});
  await vi.advanceTimersByTimeAsync(1); await load.done;
  expect(load.snapshot()).toMatchObject({reason: 'byte_budget', overall: {errors: 1}});
  expect(load.evidence().some(s => s.kind === 'request' && !s.ok)).toBe(true);
});
it('cleans up an acknowledged own bookmark after an interrupted delete', async () => {
  setup(); const actual = fake.reader.mutate.getMockImplementation()!; let calls = 0;
  fake.reader.mutate.mockImplementation(async (...args) => {if (++calls === 4) throw new TypeError('synthetic failure'); return actual(...args);});
  const load = await startMemberCapacity(options()); await vi.advanceTimersByTimeAsync(1); await load.done;
  expect(load.snapshot()).toMatchObject({reason: 'operation_failed', cleanupFailures: 0, finished: true});
  expect(fake.reader.mutate).toHaveBeenCalledTimes(7);
  const first = fake.reader.mutate.mock.calls[0][2][0], cleanup = fake.reader.mutate.mock.calls[4][2][0];
  expect(cleanup.kind).toBe('deleteBookmark'); expect(cleanup.payload.bookmarkId).toBe(first.payload.bookmarkId);
});

it('drains a started media operation at hold expiry without cancelling it', async () => {
  setup();
  // A one-second baseline reaches playback before expiry, then drains that operation.
  const load = await startMemberCapacity({...options(), seconds: 1}), timer = keepGate(load);
  await vi.advanceTimersByTimeAsync(100000); await load.done; clearInterval(timer);
  expect(load.snapshot()).toMatchObject({finished: true, reason: null, cleanupFailures: 0, playbackHolds: {completed: 1, interrupted: 0, failed: 0}});
  expect(fake.client.createBulletinDownloadJob).not.toHaveBeenCalled();
});

it.each(['2026-10-29T00:29:43.220Z', '2026-10-29T00:29:43.000Z'])('restores own progress when the server trims timestamp zeros (%s)', async stamp => {
  setup(); vi.setSystemTime(new Date(stamp));
  const read = fake.reader.privateState.getMockImplementation()!;
  fake.reader.privateState.mockImplementation(async (...args) => {
    const result = await read(...args);
    if (result.state.progress) result.state.progress.recordedAt = result.state.progress.recordedAt.replace(/(\.\d*?)0+Z$/, '$1Z').replace('.Z', 'Z');
    return result;
  });
  const load = await startMemberCapacity(options()), timer = keepGate(load);
  await vi.advanceTimersByTimeAsync(100000); await load.done; clearInterval(timer);
  expect(load.snapshot().cleanupFailures).toBe(0);
  expect(load.cleanupLedger().pendingProgressIssues).toEqual([]);
});

it.each(['2020-01-01T00:00:00Z', 'invalid'])('does not restore progress with an unowned timestamp (%s)', async stamp => {
  setup(); const read = fake.reader.privateState.getMockImplementation()!;
  fake.reader.privateState.mockImplementation(async (...args) => {
    const result = await read(...args);
    if (result.state.progress) result.state.progress.recordedAt = stamp;
    return result;
  });
  const load = await startMemberCapacity(options()), timer = keepGate(load);
  await vi.advanceTimersByTimeAsync(100000); await load.done; clearInterval(timer);
  expect(load.snapshot().cleanupFailures).toBe(1);
  expect(load.cleanupLedger().pendingProgressIssues).toEqual([issueId]);
});
it('skips video playback while retaining catalog, reader synchronization and complete PDF delivery', async () => {
  const fetcher = setup(); const load = await startMemberCapacity({...options(), skipVideoPlayback: true}), timer = keepGate(load);
  await vi.advanceTimersByTimeAsync(100000); await load.done; clearInterval(timer);
  expect(load.snapshot()).toMatchObject({workload: 'member-api-with-pdf', finished: true, reason: null, playing: 0, overall: {attempts: 11, errors: 0}, playbackHolds: {started: 0}});
  expect(load.snapshot().operations).not.toHaveProperty('media_play');
  for (const fn of [fake.media.grant, fake.media.exchange, fake.media.heartbeat, fake.media.clear]) expect(fn).not.toHaveBeenCalled();
  expect(fake.media.listPage).toHaveBeenCalled(); expect(fake.reader.mutate).toHaveBeenCalledTimes(6);
  expect(fake.client.createBulletinDownloadJob).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls.some(([request]) => request.url.includes('/file?'))).toBe(true);
  expect(fetcher.mock.calls.every(([request]) => new URL(request.url).origin === location.origin)).toBe(true);
});
