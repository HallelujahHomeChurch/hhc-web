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
      data: {clickBehavior: 'url', url: '/'}
    }));
  });

  it('closes dismiss-only notifications without opening the website', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const matchAll = vi.fn();
    const openWindow = vi.fn();
    const worker = {
      location: {origin: 'https://www.alive.org.tw'},
      registration: {showNotification: vi.fn()},
      clients: {matchAll, openWindow},
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
      skipWaiting: vi.fn()
    };
    vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {self: worker, URL, Promise});

    const close = vi.fn();
    const waitUntil = vi.fn();
    listeners.get('notificationclick')?.({
      notification: {close, data: {clickBehavior: 'dismiss', url: '/unused'}},
      waitUntil
    });

    expect(close).toHaveBeenCalledOnce();
    expect(waitUntil).not.toHaveBeenCalled();
    expect(matchAll).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('defaults legacy notifications to opening their safe target', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const openWindow = vi.fn().mockResolvedValue(undefined);
    const worker = {
      location: {origin: 'https://www.alive.org.tw'},
      registration: {showNotification: vi.fn()},
      clients: {matchAll: vi.fn().mockResolvedValue([]), openWindow},
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
      skipWaiting: vi.fn()
    };
    vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {self: worker, URL, Promise});

    let completion: Promise<unknown> | undefined;
    listeners.get('notificationclick')?.({
      notification: {close: vi.fn(), data: {url: '/zh-Hant/news'}},
      waitUntil: (promise: Promise<unknown>) => { completion = promise; }
    });
    await completion;

    expect(openWindow).toHaveBeenCalledWith('/zh-Hant/news');
  });
});
