import {createServer} from 'node:http';
import {createPatchedFetcher} from 'next/dist/server/lib/patch-fetch';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {publicContentClient} from './client';

const constructor = vi.hoisted(() => vi.fn());
vi.mock('@hallelujahhomechurch/hhc-web-client', () => ({createHhcWebClient: constructor}));

function fetcher(fresh = false): typeof fetch {
  publicContentClient(fresh);
  return constructor.mock.lastCall![0].fetcher;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); constructor.mockClear(); });

describe('public content transport', () => {
  it.each([false, true])('preserves the cache policy (fresh=%s) without retries', async (fresh) => {
    const transport = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', transport);
    await fetcher(fresh)('http://content.test', {headers: {'X-Test': 'kept'}});
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.lastCall![1]).toMatchObject({headers: {'X-Test': 'kept'}, ...(fresh ? {cache: 'no-store'} : {next: {revalidate: 60}})});
    expect(transport.mock.lastCall![1].signal).toBeInstanceOf(AbortSignal);
  });

  it.each([204, 205, 304])('preserves bodyless status %s and headers', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status, headers: {'X-Test': 'kept'}})));
    const response = await fetcher()('http://content.test');
    expect(response.status).toBe(status);
    expect(response.headers.get('X-Test')).toBe('kept');
    expect(response.body).toBeNull();
  });

  it('preserves HTTP error status, status text and JSON without reclassification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":"forbidden"}', {
      status: 403, statusText: 'Forbidden', headers: {'Content-Type': 'application/json'}
    })));
    const response = await fetcher()('http://content.test');
    expect(response.status).toBe(403);
    expect(response.statusText).toBe('Forbidden');
    expect(response.ok).toBe(false);
    await expect(response.json()).resolves.toEqual({code: 'forbidden'});
  });

  it.each(['request', 'init'])('does not send an already cancelled %s', async (source) => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    const controller = new AbortController();
    controller.abort();
    const request = new Request('http://content.test', source === 'request' ? {signal: controller.signal} : {});
    await expect(fetcher()(request, source === 'init' ? {signal: controller.signal} : undefined)).rejects.toMatchObject({name: 'AbortError'});
    expect(transport).not.toHaveBeenCalled();
  });

  it.each(['request', 'init'])('propagates in-flight %s cancellation', async (source) => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), {once: true});
    })));
    const request = new Request('http://content.test', source === 'request' ? {signal: controller.signal} : {});
    const result = fetcher()(request, source === 'init' ? {signal: controller.signal} : undefined);
    controller.abort();
    await expect(result).rejects.toMatchObject({name: 'AbortError'});
  });

  it('shares one lazy deadline with fallback requests and rejects expired work before sending', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const transport = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', transport);
    const read = fetcher();
    expect(timeout).not.toHaveBeenCalled();
    await read('http://content.test');
    controller.abort(new DOMException('deadline', 'TimeoutError'));
    await expect(read('http://content.test/legacy')).rejects.toMatchObject({name: 'TimeoutError'});
    expect(timeout).toHaveBeenCalledExactlyOnceWith(35_000);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('bounds framework work that ignores cancellation (body=%s)', async (body) => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    vi.stubGlobal('fetch', vi.fn(() => body
      ? Promise.resolve(new Response(new ReadableStream()))
      : new Promise(() => {})));
    const result = fetcher()('http://content.test');
    controller.abort(new DOMException('deadline', 'TimeoutError'));
    await expect(result).rejects.toMatchObject({name: 'TimeoutError'});
  });

  it.each([false, true])('bounds real Next foreground revalidation with a detached signal (body=%s)', async (body) => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    let finishHeaders!: (response: Response) => void;
    let finishBody!: () => void;
    const upstream = vi.fn<typeof fetch>(() => body
      ? Promise.resolve(new Response(new ReadableStream({start(controller) { finishBody = () => controller.close(); }})))
      : new Promise((resolve) => { finishHeaders = resolve; }));
    // Exercise the installed Next implementation, not a mock of its fetch logic.
    // A legacy ISR consumer waits for the stale fetch entry to revalidate.
    const workStore = {
      isStaticGeneration: true, isRevalidate: true, route: '/content-test',
      pendingRevalidates: {} as Record<string, Promise<unknown>>,
      incrementalCache: {
        generateCacheKey: async () => 'content-key', lock: async () => () => {},
        get: vi.fn(async () => ({isStale: true, value: {kind: 'FETCH', revalidate: 60, data: {
          headers: {'content-type': 'application/json'}, body: Buffer.from('{}').toString('base64'),
          status: 200, url: 'http://content.test'
        }}})),
        set: async () => {}
      }
    };
    const stores = {
      workAsyncStorage: {getStore: () => workStore},
      workUnitAsyncStorage: {getStore: () => ({type: 'prerender-legacy', revalidate: 60, expire: Infinity, stale: Infinity, tags: []})}
    } as unknown as Parameters<typeof createPatchedFetcher>[1];
    vi.stubGlobal('fetch', createPatchedFetcher(upstream, stores));
    // openapi-fetch passes Request, while our adapter adds signal and next in init.
    const result = fetcher()(new Request('http://content.test'));
    const rejected = expect(result).rejects.toMatchObject({name: 'TimeoutError'});
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    expect(workStore.incrementalCache.get).toHaveBeenCalledTimes(1);
    deadline.abort(new DOMException('deadline', 'TimeoutError'));
    await rejected;
    expect(upstream.mock.lastCall![1]?.signal).toBeUndefined();
    expect((upstream.mock.lastCall![0] as Request).signal.aborted).toBe(false);
    // Next owns this detached work. Finish it so the test leaves no pending read.
    if (body) finishBody(); else finishHeaders(new Response('{}'));
    await Promise.all(Object.values(workStore.pendingRevalidates));
  });

  it.each([false, true])('aborts a real stalled response, including after headers (headers=%s)', async (headers) => {
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => nativeTimeout(500));
    const server = createServer((_request, response) => {
      if (headers) { response.writeHead(200, {'Content-Type': 'application/json'}); response.write('{'); }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('missing test address');
      const read = fetcher();
      const result = read(`http://127.0.0.1:${address.port}`).then((response) => response.json());
      await expect(result).rejects.toMatchObject({name: 'TimeoutError'});
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
