import {createServer} from 'node:http';
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
      const response = read(`http://127.0.0.1:${address.port}`);
      // Prove that receiving headers does not end the deadline.
      const result = headers ? (await response).json() : response;
      await expect(result).rejects.toMatchObject({name: 'TimeoutError'});
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
