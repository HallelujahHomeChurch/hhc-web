import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {expect, it, vi} from 'vitest';

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = {match: vi.fn(), put: vi.fn().mockResolvedValue(undefined)};
  const fetcher = vi.fn().mockRejectedValue(new TypeError('offline'));
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {self: {location: {origin: 'https://www.alive.org.tw'}, addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener)}, URL, Promise, Request, Response, fetch: fetcher, caches: {open: async () => cache}});
  const request = async (url: string, options: RequestInit = {}, navigate = false) => {
    const req = new Request(`https://www.alive.org.tw${url}`, options);
    if (navigate) Object.defineProperty(req, 'mode', {value: 'navigate'});
    let response: Promise<Response> | undefined;
    listeners.get('fetch')?.({request: req, respondWith: (value: Promise<Response>) => {response = value;}});
    return response;
  };
  return {cache, fetcher, request};
}
it('keeps member requests and all Authorization-bearing requests outside Cache Storage', async () => {
  const w = worker();
  await expect(w.request('/api/member/bulletins/online')).rejects.toThrow('offline');
  await expect(w.request('/_next/static/chunk.js', {headers: {Authorization: 'Bearer test-only'}})).rejects.toThrow('offline');
  expect(w.cache.match).not.toHaveBeenCalled(); expect(w.cache.put).not.toHaveBeenCalled();
});
it('falls back only to the exact UI-locale no-content shell, never another bulletin HTML', async () => {
  const w = worker();
  w.cache.match.mockResolvedValue(new Response('generic shell'));
  const response = await w.request('/en/literature-ministry/1739/read/general/zh-Hant', {}, true);
  expect(await response?.text()).toBe('generic shell');
  expect(w.cache.match).toHaveBeenCalledWith('/en/literature-ministry/offline/reader-shell');
  expect(w.cache.put).not.toHaveBeenCalled();
  w.cache.match.mockClear();
  expect(await w.request('/en/literature-ministry/1739/read/general/unknown', {}, true)).toBeUndefined();
  expect(w.cache.match).not.toHaveBeenCalled();
});
it('caches only public code responses without private/no-store headers', async () => {
  const w = worker();
  w.fetcher.mockResolvedValueOnce(new Response('code', {headers: {'Cache-Control': 'public, max-age=31536000, immutable'}}));
  await w.request('/_next/static/chunk.js'); expect(w.cache.put).toHaveBeenCalledOnce();
  w.cache.put.mockClear(); w.fetcher.mockResolvedValueOnce(new Response('private', {headers: {'Cache-Control': 'private, no-store'}}));
  await w.request('/_next/static/other.js'); expect(w.cache.put).not.toHaveBeenCalled();
});
it('does not break online code loading when browser cache storage is full', async () => {
  const w = worker();
  w.cache.put.mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  w.fetcher.mockResolvedValueOnce(new Response('online code', {headers: {'Cache-Control': 'public, max-age=31536000, immutable'}}));
  expect(await (await w.request('/_next/static/chunk.js'))?.text()).toBe('online code');
});
it('opens the generic offline list from the installed root start URL only if a shell was explicitly prepared', async () => {
  const w = worker();
  w.cache.match.mockImplementation(async path => path === '/en/literature-ministry/offline/reader-shell' ? new Response('generic') : undefined);
  const response = await w.request('/', {}, true);
  expect(response?.status).toBe(302);
  expect(response?.headers.get('Location')).toBe('https://www.alive.org.tw/en/literature-ministry/offline');
  w.cache.match.mockResolvedValue(undefined);
  expect((await w.request('/', {}, true))?.status).toBe(503);
});
