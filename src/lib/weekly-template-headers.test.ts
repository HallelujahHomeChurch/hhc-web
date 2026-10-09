import {describe, expect, it} from 'vitest';
import config from '../../next.config';

describe('weekly template asset headers', () => {
  it.each([
    '/assets/weekly/v2/body-sc-400-0d9a3e4fd55d8e7bcfe5fa7e4f969d6d46519a76e3414c487b1fcf0a1005dd8d.woff2',
    '/assets/weekly/v2/body-sc-700-714f0a66d4e38eb4006744fc12126d837b9294eabbe67632b6b12945de3ca1b4.woff2'
  ])('avoids revalidating the pinned Simplified font %s on every reader visit', async source => {
    const headers = await config.headers!();
    expect(headers.find(rule => rule.source === source)?.headers ?? []).toContainEqual({key: 'Cache-Control', value: 'public, max-age=31536000, immutable'});
  });

  it('caches content-hashed fonts immutably without caching the manifest forever', async () => {
    const headers = await config.headers!();
    const fonts = headers.filter(rule => rule.source.startsWith('/assets/weekly/v1/') && rule.source.endsWith('.woff2'));
    expect(fonts).toHaveLength(4);
    expect(fonts.some(font => font.source.includes('/symbol-89ed6ff28006ceddbfb893fc2812b5868c5b691341c48959a092b25f33ec5bdd.woff2'))).toBe(true);
    for (const font of fonts) {
      expect(font.headers).toContainEqual({key: 'Cache-Control', value: 'public, max-age=31536000, immutable'});
    }
    expect(headers.find(rule => rule.source === '/assets/weekly/v1/manifest.json')?.headers).toContainEqual({key: 'Cache-Control', value: 'public, max-age=0, must-revalidate'});
  });
});
