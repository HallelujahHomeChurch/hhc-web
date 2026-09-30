import {describe, expect, it} from 'vitest';
import config from '../../next.config';

describe('weekly template asset headers', () => {
  it('caches content-hashed fonts immutably without caching the manifest forever', async () => {
    const headers = await config.headers!();
    const fonts = headers.filter(rule => rule.source.startsWith('/assets/weekly/v1/') && rule.source.endsWith('.woff2'));
    expect(fonts).toHaveLength(3);
    for (const font of fonts) {
      expect(font.headers).toContainEqual({key: 'Cache-Control', value: 'public, max-age=31536000, immutable'});
    }
    expect(headers.find(rule => rule.source === '/assets/weekly/v1/manifest.json')?.headers).toContainEqual({key: 'Cache-Control', value: 'public, max-age=0, must-revalidate'});
  });
});
