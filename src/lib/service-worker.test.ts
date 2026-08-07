import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe, expect, it, vi} from 'vitest';

describe('service worker push handling', () => {
  it('keeps notification click targets on the website origin', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const worker = {
      location: {origin: 'https://www.alive.org.tw'},
      registration: {showNotification},
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
      skipWaiting: vi.fn()
    };
    vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {self: worker, URL, Promise});

    let completion: Promise<unknown> | undefined;
    listeners.get('push')?.({
      data: {json: () => ({title: 'News', body: 'Body', actionUrl: 'https://attacker.example/path'})},
      waitUntil: (promise: Promise<unknown>) => { completion = promise; }
    });
    await completion;

    expect(showNotification).toHaveBeenCalledWith('News', expect.objectContaining({
      data: {url: '/'}
    }));
  });
});
