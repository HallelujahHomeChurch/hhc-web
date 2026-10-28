import {afterEach, expect, it, vi} from 'vitest';
import {startMemberCapacity} from './member-capacity';
import {readerFixture} from '../src/features/weekly-reader/test-fixture';
import {applyLocalMutation} from '../src/features/weekly-reader/private-state';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';

afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

it('executes the actual pinned clients against synthetic HTTP contracts, including verified reader bytes', async () => {
  vi.useFakeTimers({toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']});
  vi.stubGlobal('location', {origin: 'https://www.alive.org.tw', href: 'https://www.alive.org.tw/zh-Hant'});
  const value = readerFixture(), id = value.document.issueId, hash = 'a'.repeat(64);
  const recording = '00000000-0000-4000-8000-000000000003';
  let state: BulletinReaderState = {accountId: value.access.accountId, documentId: value.document.documentId, currentRevision: 1, appliedRevision: 1, highlights: [], notes: [], bookmarks: [], progress: null, conflicts: []};
  const accessBody = JSON.stringify({data: value, meta: {}, error: null});
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessBody)))].map(v => v.toString(16).padStart(2, '0')).join('');
  const json = (data: unknown, meta: unknown = {}) => Response.json({data, meta, error: null});
  let mediaRoot = '';
  const paths: string[] = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    const url = new URL(request.url), path = url.pathname; paths.push(path);
    if (path.endsWith('/session')) return Response.json({authenticated: true, user: {id: value.access.accountId, email: 'fixture@example.invalid', display_name: 'Synthetic fixture', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}});
    if (path.endsWith('/csrf-token')) return Response.json({csrf_token: 'synthetic-csrf'});
    if (path.endsWith('/session/access-token')) return Response.json({access_token: 'synthetic-token', expires_in: 900});
    if (path === '/api/member/bulletins/online') return json({items: [{issueId: id, issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant', onlineRevision: 1}], total: 1});
    if (path.endsWith('/online/access')) return new Response(accessBody, {headers: {'content-type': 'application/json', 'X-HHC-Content-SHA256': digest}});
    if (path.endsWith('/reader/state')) return json({state});
    if (path.endsWith('/reader/mutations')) {
      const {mutations} = await request.json() as {mutations: BulletinReaderMutation[]};
      for (const m of mutations) {
        if (m.kind === 'createBookmark') state.bookmarks!.push({...m.payload, id: m.payload.bookmarkId, version: 1, documentRevision: 1, deleted: false, reanchorRequired: false, createdAt: m.createdAt, updatedAt: m.createdAt});
        else if (m.kind === 'deleteBookmark') state.bookmarks!.find(b => b.id === m.payload.bookmarkId)!.deleted = true;
        else state = applyLocalMutation(state, m, value.document);
      }
      return json({state, results: mutations.map(m => ({mutationId: m.mutationId, status: 'applied'}))});
    }
    if (path === '/api/member/recordings') return json([], {nextCursor: null});
    if (path.endsWith('/cover')) return new Response('synthetic-jpeg', {headers: {'content-type': 'image/jpeg'}});
    if (path.endsWith('/playback')) {
      const {playbackScopeId} = await request.json();
      mediaRoot = `https://media.alive.org.tw/videos/${recording}/packages/${'b'.repeat(32)}/sessions/${playbackScopeId}/`;
      return json({mediaUrl: mediaRoot + 'master.m3u8', exchangeCredential: 'synthetic-exchange', expiresAt: new Date(Date.now() + 3600000).toISOString(), assetVersionId: 'synthetic-version', watermarkCode: 'synthetic'});
    }
    if (url.host === 'media.alive.org.tw') {
      if (path.endsWith('/cookie')) return new Response(null, {status: 204});
      if (path.endsWith('master.m3u8')) return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n720p/index.m3u8');
      if (path.endsWith('index.m3u8')) return new Response('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n' + Array.from({length: 30}, (_, i) => `#EXTINF:5,\nseg-${i}.m4s`).join('\n') + '\n#EXT-X-ENDLIST');
      return new Response('complete synthetic media');
    }
    if (path.endsWith('/bulletin-download-jobs')) return json({id, operationProgress: {status: 'ready'}});
    if (path.endsWith('/file')) return new Response('%PDF-complete synthetic file');
    if (new RegExp(`/api/member/recordings/${recording}/(watch|interactions|metrics|comments|heartbeat)$`).test(path)) return json({});
    throw new Error('Unexpected synthetic route');
  });
  const load = await startMemberCapacity({runId: 'offline-real-client', scopeHash: hash, gate: {scopeHash: hash, observedAt: Date.now(), deadline: Date.now() + 300000, ready: true}, flows: 1, seconds: 120, mode: 'baseline', issues: [{issueId: id, issueNumber: 1739, writable: true}], recordings: [{id: recording, analyticsApproved: true}], remainingRequests: 2000, remainingBytes: 10 * 1024 ** 2});
  const gate = setInterval(() => load.updateGate({scopeHash: hash, observedAt: Date.now(), deadline: Date.now() + 300000, ready: true}), 1000);
  await vi.advanceTimersByTimeAsync(100000); await load.done; clearInterval(gate);
  expect(load.snapshot()).toMatchObject({finished: true, reason: null, cleanupFailures: 0, overall: {attempts: 7, errors: 0}});
  expect(state.progress).toBeNull(); expect(state.notes.every(n => n.deleted)).toBe(true); expect(state.bookmarks!.every(b => b.deleted)).toBe(true);
  expect(paths.some(p => p.endsWith('/online/access'))).toBe(true);
  expect(load.cleanupLedger()).toMatchObject({pendingProgressIssues: [], pendingObjects: []});
});
