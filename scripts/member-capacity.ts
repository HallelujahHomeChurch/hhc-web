import {createAccountSessionClient, createBrowserAccountAuthRuntime} from '@hallelujahhomechurch/account-client';
import {createHhcWebClient, type OnlineBulletinAccess, type BulletinReaderMutation, type BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {createReaderApi, type ReaderSelector} from '../src/features/weekly-reader/api';
import {bookmarkTargets} from '../src/features/weekly-reader/bookmarks';
import {createMemberVideoApi} from '../src/features/member-videos/api';
import {createProtectedFetch} from '../src/features/weekly/api';
import {parsePlaylist, scopedURL} from './public-live-load';
import {errorCategory, gateValid, operationDeck, randomSequence, requestFamily, sloReason, summarize, weights, type Gate, type Operation, type Sample} from './member-capacity-model';

type Options = {
  runId: string; scopeHash: string; gate: Gate; flows: number; seconds: number; mode: 'baseline' | 'mixed';
  issues: {issueId: string; issueNumber: number; writable: boolean}[];
  recordings: {id: string; analyticsApproved: boolean}[];
  remainingRequests: number; remainingBytes: number;
};
const requireValue = (ok: unknown) => {if (!ok) throw new Error('invalid_load_evidence');};
let running = false;

// Read-only fixture discovery never returns identity, credentials or private state.
export async function inspectMemberFixtures() {
  requireValue(location.origin === 'https://www.alive.org.tw' && !running);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  let attempts = 0, receivedBytes = 0;
  const fetcher: typeof fetch = async (input, init) => {
    requireValue(++attempts <= 20);
    const request = new Request(input instanceof Request ? input : new URL(String(input), location.origin), init);
    const family = requestFamily(new URL(request.url), request.method, location.origin);
    requireValue(['account.read', 'account.token', 'bulletin.discovery', 'reader.state', 'recording.list'].includes(family));
    const response = await fetch(request, {signal: AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(5000)]), redirect: 'error'});
    const body = await response.arrayBuffer(); receivedBytes += body.byteLength; requireValue(receivedBytes <= 10 * 1024 ** 2);
    return new Response(body, {status: response.status, headers: response.headers});
  };
  const account = createAccountSessionClient({baseUrl: '/api/account/v1', fetcher}), auth = createBrowserAccountAuthRuntime({client: account});
  try {
    const state = await auth.start(); requireValue(state.status === 'authenticated');
    const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => null, fetcher: createProtectedFetch(auth, fetcher)});
    const discovery = await client.listOnlineBulletinDiscovery({series: 'general', locale: 'zh-Hant', limit: 6, offset: 0, signal: controller.signal});
    const bulletins = [];
    for (const edition of discovery.items.filter(e => e.onlineRevision)) {
      const value = await client.getReaderState({issueId: edition.issueId, series: 'general', locale: 'zh-Hant', fromRevision: edition.onlineRevision!, signal: controller.signal});
      requireValue(state.status === 'authenticated' && value.state.accountId === state.session.user.id);
      bulletins.push({issueId: edition.issueId, issueNumber: edition.issueNumber, emptyPrivateState: !value.state.progress && !value.state.highlights.length && !value.state.notes.length && !value.state.bookmarks?.length && !value.state.conflicts.length});
    }
    const recordings = await client.listMemberRecordingsPage({limit: 12, signal: controller.signal});
    return {authenticated: true, attempts, receivedBytes, bulletins, recordings: recordings.items.map(r => ({id: r.id, durationSeconds: r.durationSeconds, expiresAt: r.expiresAt}))};
  } finally {clearTimeout(timer); auth.dispose();}
}

// Loading the bundle is inert. A fresh external safety gate is required to start.
export async function startMemberCapacity(options: Options) {
  requireValue(location.origin === 'https://www.alive.org.tw' && !running);
  requireValue(/^[a-zA-Z0-9-]{1,80}$/.test(options.runId) && gateValid(options.gate, options.scopeHash, Date.now()));
  requireValue(Number.isInteger(options.flows) && options.flows >= 1 && options.flows <= 1000 && options.seconds > 0 && options.seconds <= 3600);
  requireValue(options.mode === 'mixed' || options.mode === 'baseline' && options.flows === 1);
  requireValue(options.issues.length > 0 && options.issues.every(i => /^[a-f0-9-]{36}$/.test(i.issueId) && Number.isInteger(i.issueNumber)));
  requireValue(options.recordings.length > 0 && options.recordings.every(r => /^[a-f0-9-]{36}$/.test(r.id) && r.analyticsApproved));
  requireValue(options.issues.some(i => i.writable) && options.remainingRequests > options.flows * 2 && options.remainingRequests <= 200000 && options.remainingBytes > 0 && options.remainingBytes <= 30 * 1024 ** 3);
  running = true;
  const started = performance.now();
  let holdStarted: number | null = options.mode === 'baseline' ? started : null;
  let workloadEnd = started + (options.mode === 'baseline' ? options.seconds * 1000 : 45000);
  const abort = new AbortController(), signal = abort.signal;
  let gate = options.gate, requests = 0, bytes = 0, active = 0, playing = 0, inFlight = 0, reason: string | null = null;
  let finishedAt: number | null = null, maxSchedulerLagMs = 0, cleanupFailures = 0;
  let cleanupInProgress = 0;
  const playbackHolds = {started: 0, completed: 0, interrupted: 0, failed: 0};
  const samples: Sample[] = [], outstanding = new Set<Promise<unknown>>();
  const progressBaselines = new Map<string, {selector: ReaderSelector; document: OnlineBulletinAccess; progress: BulletinReaderState['progress']} >();
  const progressWrites = new Map<string, string>();
  const privateLedgers: {issueId: string; bookmarks: Map<string, number | null>; notes: Map<string, number | null>}[] = [];
  const stop = (code = 'operator') => {reason ??= code; if (!signal.aborted) abort.abort(code);};
  const check = () => {
    if (!gateValid(gate, options.scopeHash, Date.now())) stop('safety_gate');
    if (performance.now() >= workloadEnd) stop(holdStarted === null ? 'ramp_timeout' : 'duration');
    signal.throwIfAborted();
  };
  const pause = (ms: number, stopSignal = signal) => new Promise<void>((resolve, reject) => {
    const onAbort = () => {clearTimeout(timer); reject(stopSignal.reason);};
    const timer = setTimeout(() => {stopSignal.removeEventListener('abort', onAbort); resolve();}, Math.max(0, ms));
    if (stopSignal.aborted) onAbort(); else stopSignal.addEventListener('abort', onAbort, {once: true});
  });
  async function measured<T>(kind: Sample['kind'], name: string, flow: number, action: () => Promise<T>) {
    const before = performance.now(); let ok = false, error: Sample['error'];
    try {const result = await action(); ok = true; return result;}
    catch (failure) {error = errorCategory(failure); throw failure;}
    finally {samples.push({kind, name, flow, startMs: before - started, durationMs: performance.now() - before, ok, ...(error ? {error} : {})});}
  }
  const boundedFetch: typeof fetch = async (input, init) => {
    const request = new Request(input instanceof Request ? input : new URL(String(input), location.origin), init);
    const url = new URL(request.url), family = requestFamily(url, request.method, location.origin);
    const cleanup = request.method === 'DELETE' && family === 'media.cookie' || cleanupInProgress > 0 && ['reader.state', 'reader.mutations', 'account.read', 'account.token'].includes(family);
    if (!cleanup) check();
    if (requests >= options.remainingRequests - (cleanup ? 0 : options.flows)) {stop('request_budget'); throw new Error('request_budget');}
    requests++; inFlight++;
    const before = performance.now(); let status = 0, ok = false, error: Sample['error'];
    try {
      const timeout = AbortSignal.timeout(5000);
      const response = await fetch(request, {redirect: 'error', signal: AbortSignal.any([request.signal, timeout, ...(cleanup ? [] : [signal])])});
      status = response.status;
      if (status === 429) stop('rate_limit_429');
      const chunks: Uint8Array[] = []; let size = 0;
      const reader = response.body?.getReader();
      if (reader) try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength; bytes += chunk.value.byteLength;
          if (bytes > options.remainingBytes || size > 64 * 1024 ** 2) {stop('byte_budget'); await reader.cancel(); throw new Error('byte_budget');}
          chunks.push(chunk.value);
        }
      } finally {reader.releaseLock();}
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) {body.set(chunk, offset); offset += chunk.byteLength;}
      ok = response.ok;
      if (!ok) error = 'http';
      if (cleanup && !ok) throw new Error('cleanup_failed');
      return new Response([204, 205, 304].includes(status) ? null : body, {status, headers: response.headers});
    } catch (failure) {error ??= errorCategory(failure); throw failure;
    } finally {
      inFlight--; samples.push({kind: 'request', name: family, flow: -1, startMs: before - started, durationMs: performance.now() - before, ok, status, ...(error ? {error} : {})});
    }
  };
  const account = createAccountSessionClient({baseUrl: '/api/account/v1', fetcher: boundedFetch});
  const auth = createBrowserAccountAuthRuntime({client: account});
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => null, fetcher: createProtectedFetch(auth, boundedFetch)});
  const readerApi = createReaderApi(auth, boundedFetch), mediaApi = createMemberVideoApi(auth, boundedFetch);
  const clock = setInterval(() => {
    try {
      check();
      const recent = samples.filter(s => s.startMs >= performance.now() - started - 30000 && s.kind === 'request');
      if (recent.filter(s => s.status! >= 500 || s.error === 'timeout').length >= 3 && recent.filter(s => !s.ok).length / recent.length > .02) stop('http_error_safety');
      const foreground = samples.filter(s => s.kind === 'operation' && holdStarted !== null && s.startMs >= holdStarted - started);
      if (sloReason(foreground)) stop('overall_slo');
      for (const name of new Set(foreground.map(s => s.name))) if (sloReason(foreground.filter(s => s.name === name))) stop('operation_slo');
    } catch { /* The abort signal owns shutdown. */ }
  }, 1000);
  let nextTick = performance.now() + 1000;
  const scheduler = setInterval(() => {maxSchedulerLagMs = Math.max(maxSchedulerLagMs, performance.now() - nextTick); nextTick = performance.now() + 1000;}, 1000);

  const done = (async () => {
    try {
      const session = await account.getSession(); requireValue(session.authenticated);
      if (!session.authenticated) throw new Error('not_authenticated');
      const accountId = session.user.id;
      const authState = await auth.start(); requireValue(authState.status === 'authenticated');
      await Promise.all(Array.from({length: options.flows}, async (_, flow) => {
        const random = randomSequence(flow), pick = <T>(items: T[]) => items[items.length === 1 || random() < .8 ? 0 : 1 + Math.floor(random() * (items.length - 1))];
        const issue = pick(options.issues), writerIssue = options.issues.find(i => i.writable)!, recording = pick(options.recordings);
        const selector: ReaderSelector = {accountId, issueNumber: issue.issueNumber, series: 'general', contentLocale: 'zh-Hant'};
        const writerSelector: ReaderSelector = {...selector, issueNumber: writerIssue.issueNumber};
        let document: OnlineBulletinAccess | undefined, writerDocument: OnlineBulletinAccess | undefined;
        const ownedBookmarks = new Map<string, number | null>();
        const ownedNotes = new Map<string, number | null>();
        privateLedgers.push({issueId: writerIssue.issueId, bookmarks: ownedBookmarks, notes: ownedNotes});
        const uuid = () => crypto.randomUUID();
        async function open() {
          document = await readerApi.open(selector, {clientRequestId: uuid()}, signal);
          requireValue(document.document.issueId === issue.issueId);
          await readerApi.privateState(selector, document, signal);
        }
        async function mutate(mutations: BulletinReaderMutation[]) {
          requireValue(writerIssue.writable && writerDocument);
          const result = await readerApi.mutate(writerSelector, writerDocument!, mutations, signal);
          requireValue(result.results.every(r => r.status === 'applied'));
          return result;
        }
        type SyncKind = 'bookmark' | 'note' | 'progress' | 'state';
        async function sync(kind: SyncKind) {
          if (!writerDocument) {
            writerDocument = await readerApi.open(writerSelector, {clientRequestId: uuid()}, signal);
            requireValue(writerDocument.document.issueId === writerIssue.issueId);
            const state = await readerApi.privateState(writerSelector, writerDocument, signal);
            if (!progressBaselines.has(writerIssue.issueId)) progressBaselines.set(writerIssue.issueId, {selector: writerSelector, document: writerDocument, progress: state.state.progress});
          }
          const target = bookmarkTargets(writerDocument!.document)[0]; requireValue(target);
          const revision = writerDocument!.document.revision;
          if (kind === 'state') return readerApi.privateState(writerSelector, writerDocument!, signal);
          if (kind === 'progress') {
            const createdAt = new Date().toISOString(); progressWrites.set(writerIssue.issueId, createdAt);
            return mutate([{mutationId: uuid(), createdAt, documentRevision: revision, kind: 'setProgress', payload: {pageId: target.pageId, sentenceId: target.sentenceId}}]);
          }
          if (kind === 'bookmark') {
            const existing = ownedBookmarks.keys().next().value;
            if (existing) {
              const version = ownedBookmarks.get(existing); requireValue(version);
              await mutate([{mutationId: uuid(), createdAt: new Date().toISOString(), documentRevision: revision, kind: 'deleteBookmark', baseVersion: version!, payload: {bookmarkId: existing}}]);
              ownedBookmarks.delete(existing); return;
            }
            const id = uuid(); ownedBookmarks.set(id, null);
            const created = await mutate([{mutationId: uuid(), createdAt: new Date().toISOString(), documentRevision: revision, kind: 'createBookmark', payload: {bookmarkId: id, name: `load-${options.runId.slice(0, 32)}-${flow}`, ...target}}]);
            const bookmark = created.state.bookmarks?.find(b => b.id === id && !b.deleted); requireValue(bookmark);
            ownedBookmarks.set(id, bookmark!.version); return;
          }
          const existing = ownedNotes.keys().next().value;
          if (existing) {
            const version = ownedNotes.get(existing); requireValue(version);
            await mutate([{mutationId: uuid(), createdAt: new Date().toISOString(), documentRevision: revision, kind: 'deleteNote', baseVersion: version!, payload: {noteId: existing}}]);
            ownedNotes.delete(existing); return;
          }
          const id = uuid(); ownedNotes.set(id, null);
          const created = await mutate([{mutationId: uuid(), createdAt: new Date().toISOString(), documentRevision: revision, kind: 'createNote', payload: {noteId: id, sentenceIds: [target.sentenceId], text: `Synthetic capacity-test note ${options.runId}-${flow}`}}]);
          const saved = created.state.notes.find(n => n.id === id && !n.deleted); requireValue(saved);
          ownedNotes.set(id, saved!.version);
        }
        async function catalog() {
          const page = await mediaApi.listPage({limit: 12, signal});
          if (page.nextCursor && random() < .5) await mediaApi.listPage({limit: 12, cursor: page.nextCursor, signal});
          const query = page.items[0]?.title?.slice(0, 8);
          if (query && query.length >= 2 && random() < .3) await mediaApi.listPage({limit: 12, q: query, signal});
          await Promise.all([mediaApi.watch(recording.id, signal), mediaApi.cover(recording.id, signal), mediaApi.interactions(recording.id, signal), mediaApi.metrics(recording.id, signal), mediaApi.comments(recording.id, {limit: 20, signal})]);
        }
        async function play() {
          await mediaApi.watch(recording.id, signal);
          const scope = uuid(); let url: string | undefined, expires = 0, renewalAt = 0;
          const playbackSessionId = uuid(), duration = (45 + 45 * random()) * 1000, seek = random() < .2;
          let position = 0, sequence = 0, lastHeartbeat = performance.now(), lastPoll = performance.now();
          async function authorize() {
            const grant = await mediaApi.grant(recording.id, scope, undefined, signal);
            requireValue(Number.isFinite(Date.parse(grant.expiresAt)) && Date.parse(grant.expiresAt) > Date.now());
            const next = await mediaApi.exchange(grant, signal); requireValue(!url || url === next);
            url = next; expires = Date.parse(grant.expiresAt); renewalAt = Math.max(Date.now() + 1000, Math.min(Date.now() + 45 * 60000, expires - 10 * 60000));
          }
          const download = async (uri: string, text = false) => {
            const response = await boundedFetch(uri, {credentials: 'include', cache: 'no-store', referrerPolicy: 'no-referrer', signal});
            requireValue(response.ok);
            return text ? response.text() : (await response.arrayBuffer(), '');
          };
          try {
            await authorize(); const root = new URL('.', url!).href;
            const master = parsePlaylist(await download(url!, true)); requireValue(master.variants.length > 0);
            const height = [480, 720, 1080][flow % 10 < 2 ? 0 : flow % 10 < 7 ? 1 : 2];
            const variant = [...master.variants].sort((a, b) => Math.abs(a.height - height) - Math.abs(b.height - height))[0];
            const playlist = scopedURL(variant.uri, url!, root), list = parsePlaylist(await download(playlist, true));
            requireValue(list.ended && list.segments.length > 0);
            if (list.init) await download(scopedURL(list.init, playlist, root));
            await measured('background', 'media.first_segment', flow, () => download(scopedURL(list.segments[0].uri, playlist, root)));
            // Playback hold is dwell, measured outside the foreground startup sample.
            playing++;
            playbackHolds.started++;
            const until = performance.now() + duration;
            const playback = (async () => {
              try {
                let index = 1, sought = false;
                await pause(list.segments[0].duration * 1000);
                while (performance.now() < until) {
                  check();
                  requireValue(Date.now() < expires);
                  if (Date.now() >= renewalAt) await measured('background', 'media.renew', flow, authorize);
                  requireValue(index < list.segments.length);
                  const segment = list.segments[index++];
                  const at = performance.now();
                  await download(scopedURL(segment.uri, playlist, root)); position += segment.duration;
                  if (performance.now() - lastHeartbeat >= 15000) {
                    await measured('background', 'media.heartbeat', flow, () => mediaApi.heartbeat(recording.id, {playbackSessionId, sequence: ++sequence, state: 'playing', position, deltaPlayingMs: Math.min(30000, Math.round(performance.now() - lastHeartbeat))}, signal));
                    lastHeartbeat = performance.now();
                  }
                  if (performance.now() - lastPoll >= 30000) {
                    await measured('background', 'media.poll', flow, () => Promise.all([mediaApi.metrics(recording.id, signal), mediaApi.interactions(recording.id, signal)])); lastPoll = performance.now();
                  }
                  if (seek && !sought && position >= 15 && index + 2 < list.segments.length) {
                    sought = true; index += 2;
                    await measured('background', 'media.seek', flow, () => download(scopedURL(list.segments[index].uri, playlist, root)));
                    position += list.segments[index++].duration;
                  }
                  await pause(Math.max(0, segment.duration * 1000 - (performance.now() - at)));
                }
                playbackHolds.completed++;
              } catch (failure) {
                if (signal.aborted) playbackHolds.interrupted++; else playbackHolds.failed++;
                throw failure;
              } finally {
                playing--;
                if (url) await mediaApi.clear(url).catch(() => {cleanupFailures++;});
              }
            })();
            outstanding.add(playback); void playback.finally(() => outstanding.delete(playback)).catch(() => {});
            return {playback};
          } catch (error) {if (url) await mediaApi.clear(url).catch(() => {cleanupFailures++;}); throw error;}
        }
        async function pdf() {
          let job = await client.createBulletinDownloadJob(issue.issueId, 'zh-Hant', 'general', uuid(), signal);
          const deadline = performance.now() + 120000;
          while (job.operationProgress.status !== 'ready') {
            requireValue(job.operationProgress.status !== 'failed' && performance.now() < deadline);
            await pause(Math.min(10000, Math.max(1000, job.operationProgress.retryAfterMs ?? 1000)));
            job = await client.getBulletinDownloadJob(job.id, 'zh-Hant', 'general', signal);
          }
          const response = await boundedFetch(`/api/member/bulletin-download-jobs/${job.id}/file?locale=zh-Hant&series=general`, {credentials: 'include', headers: {authorization: `Bearer ${await auth.getAccessToken()}`}, signal});
          requireValue(response.ok); const data = new Uint8Array(await response.arrayBuffer());
          requireValue(data.length > 5 && String.fromCharCode(...data.slice(0, 5)) === '%PDF-');
        }
        const actions: Record<Operation, () => Promise<unknown>> = {
          bulletin_catalog: () => client.listOnlineBulletinDiscovery({series: 'general', locale: 'zh-Hant', limit: 12, offset: 0, ...(random() < .3 ? {issueNumber: issue.issueNumber} : {}), signal}),
          reader_open: open, reader_sync: () => sync('state'), media_catalog: catalog, media_play: play, account_read: () => account.getSession(), pdf_download: pdf,
        };
        let joined = false;
        try {
          await pause(flow / options.flows * (options.mode === 'baseline' ? 0 : 30000)); active++; joined = true;
          if (holdStarted === null && active === options.flows) {holdStarted = performance.now(); workloadEnd = holdStarted + options.seconds * 1000;}
          do {
            const deck = options.mode === 'baseline' ? Object.keys(weights) as Operation[] : operationDeck(random);
            for (const name of deck) {
              check();
              if (name === 'reader_sync') {
                const kinds: SyncKind[] = options.mode === 'baseline' ? ['bookmark', 'note', 'progress', 'state', 'bookmark', 'note'] : [(['bookmark', 'note', 'progress', 'state'] as SyncKind[])[Math.floor(random() * 4)]];
                for (const kind of kinds) {
                  const verb = kind === 'bookmark' ? ownedBookmarks.size ? 'delete' : 'create' : kind === 'note' ? ownedNotes.size ? 'delete' : 'create' : kind === 'progress' ? 'save' : 'read';
                  await measured('operation', `reader_sync.${kind}.${verb}`, flow, () => sync(kind));
                }
              } else {
                const value = await measured('operation', name, flow, actions[name]);
                if (name === 'media_play') await (value as Awaited<ReturnType<typeof play>>).playback;
              }
              if (options.mode !== 'baseline') await pause((3 + 9 * random()) * 1000 + (name === 'reader_open' ? (15 + 30 * random()) * 1000 : 0));
            }
          } while (options.mode !== 'baseline');
        } catch {if (!signal.aborted) stop('operation_failed');}
        finally {
          if (joined) active--;
          if (writerDocument && (ownedBookmarks.size || ownedNotes.size)) {
            cleanupInProgress++;
            try {
              const cleanupSignal = AbortSignal.timeout(5000);
              const state = await readerApi.privateState(writerSelector, writerDocument, cleanupSignal);
              for (const id of ownedBookmarks.keys()) {
                const item = state.state.bookmarks?.find(b => b.id === id);
                if (item && !item.deleted) {
                  const result = await readerApi.mutate(writerSelector, writerDocument, [{mutationId: uuid(), createdAt: new Date().toISOString(), documentRevision: writerDocument.document.revision, kind: 'deleteBookmark', baseVersion: item.version, payload: {bookmarkId: id}}], cleanupSignal);
                  requireValue(result.results.every(r => r.status === 'applied'));
                }
                if (item) ownedBookmarks.delete(id); else cleanupFailures++;
              }
              for (const id of ownedNotes.keys()) {
                const item = state.state.notes.find(n => n.id === id);
                if (item && !item.deleted) {
                  const result = await readerApi.mutate(writerSelector, writerDocument, [{mutationId: uuid(), createdAt: new Date().toISOString(), documentRevision: writerDocument.document.revision, kind: 'deleteNote', baseVersion: item.version, payload: {noteId: id}}], cleanupSignal);
                  requireValue(result.results.every(r => r.status === 'applied'));
                }
                if (item) ownedNotes.delete(id); else cleanupFailures++;
              }
            } catch {cleanupFailures++;}
            finally {cleanupInProgress--;}
          }
        }
      }));
    } catch {if (!signal.aborted) stop('bootstrap_failed');}
    finally {
      await Promise.allSettled([...outstanding]); clearInterval(clock); clearInterval(scheduler);
      cleanupInProgress++;
      try {
        for (const [id, baseline] of progressBaselines) {
          if (!progressWrites.has(id)) continue;
          const cleanupSignal = AbortSignal.timeout(5000);
          const state = await readerApi.privateState(baseline.selector, baseline.document, cleanupSignal);
          // Refuse a known outside write; restoration still requires an exclusive fixture.
          if (state.state.progress?.recordedAt !== progressWrites.get(id)) {cleanupFailures++; continue;}
          const result = await readerApi.mutate(baseline.selector, baseline.document, [{mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: baseline.document.document.revision, kind: 'setProgress', payload: baseline.progress ? {pageId: baseline.progress.pageId, componentId: baseline.progress.componentId, sentenceId: baseline.progress.sentenceId} : {}}], cleanupSignal);
          requireValue(result.results.every(r => r.status === 'applied'));
          progressWrites.delete(id);
        }
      } catch {cleanupFailures++;}
      finally {cleanupInProgress--; auth.dispose();}
      finishedAt = performance.now(); running = false;
    }
  })();
  return {
    done, stop,
    updateGate(next: Gate) {requireValue(gateValid(next, options.scopeHash, Date.now())); gate = next;},
    snapshot() {
      const steady = samples.filter(s => holdStarted !== null && s.startMs >= holdStarted - started && s.startMs < workloadEnd - started);
      const summary = (kind: Sample['kind']) => Object.fromEntries([...new Set(steady.filter(s => s.kind === kind).map(s => s.name))].map(name => [name, summarize(steady.filter(s => s.kind === kind && s.name === name))]));
      return {runId: options.runId, sessionModel: 'one-existing-session', flows: options.flows, active, playing, inFlight, requests, bytes, reason, finished: finishedAt !== null, elapsedMs: (finishedAt ?? performance.now()) - started, holdStartMs: holdStarted === null ? null : holdStarted - started, holdElapsedMs: holdStarted === null ? 0 : Math.min(workloadEnd, finishedAt ?? performance.now()) - holdStarted, maxSchedulerLagMs, cleanupFailures, playbackHolds: {...playbackHolds}, overall: summarize(steady.filter(s => s.kind === 'operation')), httpOverall: summarize(steady.filter(s => s.kind === 'request')), allPhasesOverall: summarize(samples.filter(s => s.kind === 'operation')), operations: summary('operation'), background: summary('background'), routes: summary('request')};
    },
    evidence() {return samples.map(s => ({...s, phase: options.mode === 'baseline' ? 'baseline' : holdStarted === null || s.startMs < holdStarted - started ? 'ramp' : s.startMs >= workloadEnd - started ? 'drain' : 'hold'}));},
    cleanupLedger() {return {runId: options.runId, pendingProgressIssues: [...progressWrites.keys()], pendingObjects: privateLedgers.filter(l => l.bookmarks.size || l.notes.size).map(l => ({issueId: l.issueId, bookmarkIds: [...l.bookmarks.keys()], noteIds: [...l.notes.keys()]}))};},
  };
}
