import {describe, expect, it} from 'vitest';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import manifest from './manifest';

describe('web app manifest', () => {
  it('is installable as a standalone HHC app', () => {
    expect(manifest()).toMatchObject({
      name: '哈利路亞家教會',
      id: '/',
      start_url: '/',
      display: 'standalone'
    });
    expect(manifest().icons).toEqual(expect.arrayContaining([
      expect.objectContaining({src: '/assets/brand/app-icon-192.png', sizes: '192x192', purpose: 'any'}),
      expect.objectContaining({src: '/assets/brand/app-icon-512.png', sizes: '512x512', purpose: 'any'})
    ]));
    expect(existsSync(join(process.cwd(), 'src/app/apple-icon.png'))).toBe(true);
  });
});
