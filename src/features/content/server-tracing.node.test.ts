import {createServer, type Server} from 'node:http';
import * as Sentry from '@sentry/nextjs';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import {createPatchedFetcher} from 'next/dist/server/lib/patch-fetch';
import {IncrementalCache} from 'next/dist/server/lib/incremental-cache';
import {publicContentClient} from './client';
import type {Locale} from '@/i18n/locales';
import {sanitizeSentrySpan} from '@/lib/observability';

type CapturedEnvelope = [unknown, Array<[{type: string; content_type?: string; item_count?: number}, unknown]>];
type WireSpan = {span_id: string; trace_id: string; parent_span_id?: string; name: string; end_timestamp: number; attributes?: Record<string, {type: string; value: unknown}>};
import {contentServerTracing, contentTraceTarget, serverTraceSampleRate} from './server-tracing';

describe('server tracing policy', () => {
  it('bounds local sampling independently of a remote sampled flag', () => {
    expect(serverTraceSampleRate('')).toBe(0.01);
    expect(serverTraceSampleRate('0')).toBe(0);
    expect(serverTraceSampleRate('0.1')).toBe(0.1);
    for (const value of ['1', '-1', 'NaN', 'Infinity']) expect(() => serverTraceSampleRate(value)).toThrow('SENTRY_TRACES_SAMPLE_RATE');
  });

  it('keeps the local probability independent of the inbound sampled flags', () => {
    const sampler = contentServerTracing().tracesSampler;
    for (const parentSampled of [false, true]) {
      expect(Reflect.apply(sampler, undefined, [{parentSampled, parentSampleRate: 1}])).toBe(0.01);
    }
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      for (const flag of ['0', '1']) {
        expect(Sentry.continueTrace({sentryTrace: `11111111111111111111111111111111-1234567890123456-${flag}`, baggage: undefined}, () => Sentry.getCurrentScope().getPropagationContext().sampleRand)).toBe(0.5);
      }
      // The Gateway must remove all baggage: a local sampler alone cannot neutralize DSC.
      expect(Sentry.continueTrace({sentryTrace: '11111111111111111111111111111111-1234567890123456-1', baggage: 'sentry-sample_rand=0'}, () => Sentry.getCurrentScope().getPropagationContext().sampleRand)).toBe(0);
    } finally { random.mockRestore(); }
  });

  it('matches only the configured origin and API path boundary', () => {
    const target = contentTraceTarget('http://127.0.0.1:3500/v1.0/invoke/hhc-web-api/method/api');
    expect(target.test('http://127.0.0.1:3500/v1.0/invoke/hhc-web-api/method/api/locations?locale=en')).toBe(true);
    for (const url of [
      'http://127.0.0.1:3500/v1.0/invoke/hhc-web-api/method/api-evil/locations',
      'http://127.0.0.1:3500/v1.0/invoke/other-api/method/api/locations',
      'http://127.0.0.1:3501/v1.0/invoke/hhc-web-api/method/api/locations',
      'http://127.0.0.1:3500.evil.test/v1.0/invoke/hhc-web-api/method/api/locations'
    ]) expect(target.test(url)).toBe(false);
    expect(() => contentTraceTarget('http://user:password@localhost/api')).toThrow();
  });
});

describe('Sentry spans and actual content wire', () => {
  let server: Server;
  let base: string;
  let externalBase: string;
  let externalServer: Server;
  const externalWire: Array<Record<string, string | string[] | undefined>> = [];
  const wire: Array<{url: string; responseId: string; headers: Record<string, string | string[] | undefined>}> = [];
  const envelopes: CapturedEnvelope[] = [];
  const nativeFetch = globalThis.fetch;
  const cache = new Map<string, unknown>();
  const keyHeaders: Headers[] = [];
  let stale = false;
  let responseIdentity: string | string[] | undefined;
  let responseIdentityHeaders: Record<string, string | string[]> | undefined;
  let unitType = 'prerender-legacy';
  const workStore = {
    isStaticGeneration: true, route: '/trace-fixture', pendingRevalidates: {} as Record<string, Promise<unknown>>,
    incrementalCache: {
      generateCacheKey: async (url: string, input: RequestInit) => {
        keyHeaders.push(new Headers(input.headers));
        return IncrementalCache.prototype.generateCacheKey.call({fetchCacheKeyPrefix: ''} as IncrementalCache, url, input);
      },
      lock: async () => () => {},
      get: async (key: string) => cache.has(key) ? {isStale: stale, value: cache.get(key)} : null,
      set: async (key: string, value: unknown) => { cache.set(key, value); }
    }
  };

  beforeAll(async () => {
    server = createServer((request, response) => {
      const responseId = `._:api-${wire.length + 1}`;
      wire.push({url: request.url!, responseId, headers: request.headers});
      if (request.url?.includes('locale=zh-Hans')) {
        response.writeHead(302, {Location: `${externalBase}/external`, 'X-HHC-Request-ID': 'api-redirect'}).end();
      } else {
        response.writeHead(200, {'Content-Type': 'application/json', ...(responseIdentityHeaders ?? {'X-HHC-Request-ID': responseIdentity ?? responseId})}).end('{"data":[]}');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing fixture address');
    base = `http://127.0.0.1:${address.port}`;
    externalServer = createServer((request, response) => { externalWire.push(request.headers); response.end('{}'); });
    await new Promise<void>((resolve) => externalServer.listen(0, '127.0.0.1', resolve));
    const externalAddress = externalServer.address();
    if (!externalAddress || typeof externalAddress === 'string') throw new Error('Missing external fixture address');
    externalBase = `http://127.0.0.1:${externalAddress.port}`;
    vi.stubEnv('HHC_WEB_API_BASE_URL', `${base}/api`);
    vi.stubEnv('SENTRY_TRACES_SAMPLE_RATE', '0.01');
    Sentry.init({
      dsn: 'http://fixture@127.0.0.1/1', ...contentServerTracing(),
      // Deterministic exporter assertions; production sampling is independently tested above.
      tracesSampler: () => 1,
      beforeSendSpan: Sentry.withStreamedSpan((span) => sanitizeSentrySpan(span as unknown as Record<string, unknown>) as unknown as typeof span),
      transport: () => ({send: async (envelope: CapturedEnvelope) => { envelopes.push(envelope); return {}; }, flush: async () => true})
    });
    const stores = {
      workAsyncStorage: {getStore: () => workStore},
      workUnitAsyncStorage: {getStore: () => ({type: unitType, revalidate: 60, expire: Infinity, stale: Infinity, tags: []})}
    } as unknown as Parameters<typeof createPatchedFetcher>[1];
    globalThis.fetch = createPatchedFetcher(nativeFetch, stores);
  });

  afterAll(async () => {
    globalThis.fetch = nativeFetch;
    await Sentry.close(1000);
    vi.unstubAllEnvs();
    externalServer.closeAllConnections();
    await new Promise<void>((resolve) => externalServer.close(() => resolve()));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function exportedSpans(): WireSpan[] {
    return envelopes.flatMap(([, items]) => items.flatMap(([header, payload]) => {
      if (header.type !== 'span') return [];
      expect(header.content_type).toBe('application/vnd.sentry.items.span.v2+json');
      const container = payload as {version: number; items: WireSpan[]};
      expect(container.version).toBe(2);
      expect(container.items).toHaveLength(header.item_count!);
      for (const span of container.items) {
        expect(span.span_id).toMatch(/^[a-f0-9]{16}$/);
        expect(span.trace_id).toMatch(/^[a-f0-9]{32}$/);
        expect(span.end_timestamp).toBeGreaterThan(0);
      }
      return container.items;
    }));
  }

  async function request(traceId: string, locale: Locale) {
    return Sentry.continueTrace({sentryTrace: `${traceId}-1234567890123456-1`, baggage: undefined}, () =>
      Sentry.startSpan({name: 'fixture.request', op: 'http.server'}, () => publicContentClient().listLocations(locale)));
  }

  it('isolates concurrent parents, records real child spans, and keeps visitor identity out of the cache key', async () => {
    const a = '11111111111111111111111111111111';
    const b = '22222222222222222222222222222222';
    await Promise.all([request(a, 'en'), request(b, 'ja')]);
    await Promise.all(Object.values(workStore.pendingRevalidates));
    const en = wire.find((call) => call.url.includes('locale=en'))!;
    const ja = wire.find((call) => call.url.includes('locale=ja'))!;
    expect(en.headers.traceparent).toMatch(new RegExp(`^00-${a}-[a-f0-9]{16}-01$`));
    expect(ja.headers.traceparent).toMatch(new RegExp(`^00-${b}-[a-f0-9]{16}-01$`));
    expect(en.headers['x-request-id']).toBeUndefined();
    expect(en.headers['sentry-trace']).toBeDefined();
    expect(en.headers.baggage).toBeDefined();
    const calls = wire.length;
    await request(b, 'en');
    expect(wire).toHaveLength(calls);
    for (const headers of keyHeaders) {
      for (const key of ['traceparent', 'sentry-trace', 'baggage', 'x-request-id']) expect(headers.has(key)).toBe(false);
    }
    await Sentry.flush(1000);
    const spans = exportedSpans();
    const outgoing = spans.find((span) => span.span_id === String(en.headers.traceparent).split('-')[2]);
    expect(outgoing?.attributes?.['hhc.api_request_id']?.value).toBe(en.responseId);
    expect(spans.some((span) => span.span_id === outgoing?.parent_span_id)).toBe(true);
  });

  it('revalidates stale data in the triggering context without replaying the cached visitor trace', async () => {
    stale = true;
    unitType = 'request';
    const trace = '33333333333333333333333333333333';
    const before = wire.length;
    await request(trace, 'en');
    await Promise.all(Object.values(workStore.pendingRevalidates));
    expect(wire.length).toBeGreaterThan(before);
    expect(wire.at(-1)!.headers.traceparent).toMatch(new RegExp(`^00-${trace}-[a-f0-9]{16}-01$`));
    const networkSpanId = String(wire.at(-1)!.headers.traceparent).split('-')[2];
    await Sentry.flush(1000);
    expect(exportedSpans().some((span) => span.span_id === networkSpanId)).toBe(true);
    stale = false;
  });

  it('scrubs the serialized span-v2 payload without dropping trace correlation', async () => {
    await Sentry.startSpan({name: 'fixture.privacy', attributes: {
      'url.full': 'https://fixture.invalid/path?token=hidden-token',
      'url.query': 'name=hidden-name', 'http.target': '/path?custom=hidden-query',
      'http.request.header.authorization': 'Bearer hidden-auth', 'http.request.cookie': 'hidden-cookie',
      'http.request.body': 'hidden-body', 'http.response.header.set-cookie': 'hidden-response-cookie',
      'user.id': 'hidden-user', 'note': 'hidden-email@example.invalid', 'hhc.api_request_id': '._:valid-id'
    }}, () => {});
    await Sentry.flush(1000);
    const span = exportedSpans().find((span) => span.name === 'fixture.privacy')!;
    expect(span).toBeDefined();
    expect(span.attributes?.['url.full']?.value).toBe('https://fixture.invalid/path');
    expect(span.attributes?.['http.target']?.value).toBe('/path');
    expect(span.attributes?.['hhc.api_request_id']?.value).toBe('._:valid-id');
    expect(JSON.stringify(span)).not.toContain('hidden-');
    expect(sanitizeSentrySpan({request: {url: '/private?token=hidden-token', headers: {cookie: 'hidden-cookie'}}, user: {id: 'hidden-user'}})).toEqual({});
  });

  it('does not record malformed, overlong or duplicate API response identities', async () => {
    try {
      for (const value of ['bad value', 'x'.repeat(129), ['first', 'second']]) {
        responseIdentity = value;
        await Sentry.startNewTrace(() => publicContentClient(true).listLocations('ko'));
        const spanId = String(wire.at(-1)!.headers.traceparent).split('-')[2];
        await Sentry.flush(1000);
        const span = exportedSpans().find((span) => span.span_id === spanId)!;
        expect(span).toBeDefined();
        expect(span.attributes?.['hhc.api_request_id']).toBeUndefined();
      }
    } finally { responseIdentity = undefined; }
  });

  it('prefers the CMS response identity and falls back only when it is absent', async () => {
    const cases: Array<{headers: Record<string, string | string[]>; expected?: string}> = [
      {headers: {'X-HHC-Request-ID': 'cms-id'}, expected: 'cms-id'},
      {headers: {'x-hhc-request-id': 'lowercase-id'}, expected: 'lowercase-id'},
      {headers: {'X-Request-ID': 'legacy-id'}, expected: 'legacy-id'},
      {headers: {'X-HHC-Request-ID': 'cms-id', 'X-Request-ID': 'legacy-id'}, expected: 'cms-id'},
      {headers: {'X-HHC-Request-ID': 'bad value', 'X-Request-ID': 'legacy-id'}},
      {headers: {'X-HHC-Request-ID': '', 'X-Request-ID': 'legacy-id'}},
      {headers: {'X-HHC-Request-ID': ['first', 'second'], 'X-Request-ID': 'legacy-id'}},
      {headers: {'X-Request-ID': ['first', 'second']}},
      {headers: {'X-Request-ID': 'bad value'}},
      {headers: {'X-Request-ID': 'x'.repeat(129)}},
      {headers: {}}
    ];
    try {
      for (const {headers, expected} of cases) {
        responseIdentityHeaders = headers;
        await Sentry.startNewTrace(() => publicContentClient(true).listLocations('ko'));
        const spanId = String(wire.at(-1)!.headers.traceparent).split('-')[2];
        await Sentry.flush(1000);
        const span = exportedSpans().find((span) => span.span_id === spanId)!;
        expect(span).toBeDefined();
        expect(span.attributes?.['hhc.api_request_id']?.value).toBe(expected);
      }
    } finally { responseIdentityHeaders = undefined; }
  });

  it('creates an independent operation without a request parent and never propagates outside the target', async () => {
    await Sentry.startNewTrace(() => publicContentClient(true).listLocations('ko'));
    expect(wire.at(-1)!.headers.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    await Sentry.startSpan({name: 'outside-path'}, () => nativeFetch(`${base}/external`));
    await Sentry.startSpan({name: 'outside-origin'}, () => nativeFetch(`${externalBase}/external`));
    for (const key of ['traceparent', 'sentry-trace', 'baggage', 'x-request-id']) expect(externalWire.at(-1)![key]).toBeUndefined();
    for (const key of ['traceparent', 'sentry-trace', 'baggage', 'x-request-id']) expect(wire.at(-1)!.headers[key]).toBeUndefined();
    const before = externalWire.length;
    await expect(publicContentClient(true).listLocations('zh-Hans')).rejects.toThrow();
    expect(externalWire).toHaveLength(before);
  });
});
