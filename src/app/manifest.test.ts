import {describe, expect, it} from 'vitest';
import manifest from './manifest';

describe('web app manifest', () => {
  it('is installable as a standalone HHC app', () => {
    expect(manifest()).toMatchObject({
      name: '哈利路亞家教會',
      id: '/',
      start_url: '/zh-Hant',
      display: 'standalone'
    });
    expect(manifest().icons).toEqual(expect.arrayContaining([
      expect.objectContaining({src: '/assets/brand/icon-192.png', sizes: '192x192'}),
      expect.objectContaining({src: '/assets/brand/logo.png', sizes: '512x512'})
    ]));
  });
});
