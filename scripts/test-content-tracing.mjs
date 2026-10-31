import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {gunzipSync} from 'node:zlib';

// Real built Next runtime, local fake API/Sentry only. No external network needed.
// Only the fixture child uses a fixed random draw so its 10% sampling emits spans deterministically.
const entry = resolve(process.argv[2] ?? '.next/standalone/server.js');
const calls = [];
const spanPayloads = [];
let envelopeError;
const api = createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture');
  if (!url.pathname.startsWith('/producer/api/')) {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        let bytes = Buffer.concat(chunks);
        if (request.headers['content-encoding'] === 'gzip') bytes = gunzipSync(bytes);
        const lines = bytes.toString().split('\n');
        for (let i = 1; i + 1 < lines.length; i += 2) {
          const header = JSON.parse(lines[i]);
          if (header.type === 'span') {
            assert.equal(header.content_type, 'application/vnd.sentry.items.span.v2+json');
            const payload = JSON.parse(lines[i + 1]);
            assert.equal(payload.version, 2);
            assert.equal(payload.items.length, header.item_count);
            spanPayloads.push(...payload.items);
          }
        }
      } catch (error) { envelopeError = error; }
      response.end('{}');
    });
    return;
  }
  calls.push({path: url.pathname, locale: url.searchParams.get('locale'), headers: request.headers});
  const locale = url.searchParams.get('locale') ?? 'en';
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('X-HHC-Request-ID', `fixture-${calls.length}`);
  if (url.pathname.endsWith('/news')) {
    response.end(JSON.stringify({data: [], meta: {page: Number(url.searchParams.get('page') ?? 1), pageSize: 12, total: 0}}));
  } else if (url.pathname.endsWith('/site-layout')) {
    response.end(JSON.stringify({data: {
      locale, siteName: 'Fixture', englishName: 'Fixture', copyrightHolder: 'Fixture', allRightsReserved: 'Fixture',
      seoTitleSuffix: 'Fixture', seoDescriptionFallback: 'Fixture', header: [], legal: [],
      links: {churchYoutube: 'https://fixture.invalid/youtube', churchFacebook: 'https://fixture.invalid/facebook', musicYoutube: 'https://fixture.invalid/music'}, version: 1, publishedAt: '2026-01-01T00:00:00Z'
    }}));
  } else {
    response.statusCode = 404;
    response.end('{"code":"not_found","message":"fixture"}');
  }
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const apiPort = api.address().port;
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
let output = '';
const child = spawn(process.execPath, ['--import', 'data:text/javascript,Math.random=()=>0.05', entry], {
  cwd: dirname(entry), stdio: ['ignore', 'pipe', 'pipe'],
  env: {...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    HHC_WEB_API_BASE_URL: `http://127.0.0.1:${apiPort}/producer/api`,
    SENTRY_DSN: `http://fixture@127.0.0.1:${apiPort}/1`, NEXT_PUBLIC_SENTRY_DSN: `http://fixture@127.0.0.1:${apiPort}/1`, SENTRY_TRACES_SAMPLE_RATE: '0.1'}
});
child.stdout.on('data', (data) => { output = (output + data).slice(-6000); });
child.stderr.on('data', (data) => { output = (output + data).slice(-6000); });
const origin = `http://127.0.0.1:${port}`;
async function visit(locale, trace, page = 1, sampled = '1', bridge = true) {
  const response = await fetch(`${origin}/${locale}/news?page=${page}&token=wire-secret-token&email=wire-person@example.invalid`, {
    // Gateway derives the Sentry compatibility header from validated W3C only.
    headers: trace ? {traceparent: `00-${trace}-1234567890123456-0${sampled}`, ...(bridge ? {'sentry-trace': `${trace}-1234567890123456-${sampled}`} : {}), authorization: 'Bearer wire-secret-auth', cookie: 'fixture=wire-secret-cookie'} : {}, signal: AbortSignal.timeout(15000)
  });
  await response.arrayBuffer();
  assert.equal(response.status, 200, 'SSR fixture must render');
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/health`, {signal: AbortSignal.timeout(500)})).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) throw new Error(`Next exited: ${child.exitCode}`);
    await delay(100);
  }
  assert.ok(ready, 'Next runtime did not start');
  const first = '11111111111111111111111111111111';
  const second = '22222222222222222222222222222222';
  await Promise.all([visit('en', first), visit('ja', second, 2, '0')]);
  const news = calls.filter((call) => call.path.endsWith('/news'));
  for (const [locale, trace] of [['en', first], ['ja', second]]) {
    const call = news.find((call) => call.locale === locale);
    assert.ok(call, `Missing ${locale} content wire request`);
    assert.match(call.headers.traceparent ?? '', new RegExp(`^00-${trace}-[a-f0-9]{16}-0[01]$`));
    assert.notEqual(call.headers.traceparent.split('-')[2], '1234567890123456', 'A child span must replace the inbound parent ID');
    assert.equal(call.headers['x-request-id'], undefined, 'No visitor request ID enters public content requests');
  }
  await visit('en', '33333333333333333333333333333333');
  assert.equal(calls.filter((call) => call.path.endsWith('/news')).length, news.length, 'A new visitor trace must reuse the content Data Cache');
  await visit('ko', undefined, 3);
  const background = calls.find((call) => call.path.endsWith('/news') && call.locale === 'ko');
  assert.match(background?.headers.traceparent ?? '', /^00-[a-f0-9]{32}-[a-f0-9]{16}-0[01]$/);
  assert.ok(![first, second].includes(background.headers.traceparent.split('-')[1]), 'No-context work must not reuse another request trace');
  const unbridged = '44444444444444444444444444444444';
  await visit('zh-Hant', unbridged, 4, '1', false);
  const fallback = calls.find((call) => call.path.endsWith('/news') && call.locale === 'zh-Hant');
  assert.match(fallback?.headers.traceparent ?? '', /^00-[a-f0-9]{32}-[a-f0-9]{16}-0[01]$/);
  assert.notEqual(fallback.headers.traceparent.split('-')[1], unbridged, 'Pinned SDK starts a new trace until the Gateway bridge is present');
  // The SDK flushes streamed batches periodically; inspect its actual HTTP envelope.
  for (let i = 0; i < 80 && !spanPayloads.some((span) => span.name === 'public-content.read'); i++) await delay(100);
  if (envelopeError) throw envelopeError;
  assert.ok(spanPayloads.some((span) => span.name === 'public-content.read'), 'Missing real runtime span-v2 export');
  const serialized = JSON.stringify(spanPayloads);
  for (const value of ['wire-secret-token', 'wire-person@example.invalid', 'wire-secret-auth', 'wire-secret-cookie']) assert.ok(!serialized.includes(value), `Span payload leaked ${value}`);
  assert.ok(spanPayloads.some((span) => span.attributes?.['hhc.api_request_id']?.value?.startsWith('fixture-')), 'API request identity must appear on a real outgoing span');
  console.log('Built Next SSR context, shared Data Cache, span-v2 export and privacy passed');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
}
