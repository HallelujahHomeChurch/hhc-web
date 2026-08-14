import {describe, expect, it} from 'vitest';
import {normalizeMetaDescription, organizationStructuredData, serializeJsonLd, toAbsoluteHttpsUrl} from './structured-data';

describe('structured data helpers', () => {
  it('normalizes descriptions and safely serializes JSON-LD', () => {
    expect(normalizeMetaDescription('  First\n  second   sentence.  ')).toBe('First second sentence.');
    expect(serializeJsonLd({'@context': 'https://schema.org', name: '</script>'})).toContain('\\u003c/script>');
  });

  it('defines the canonical HHC organization', () => {
    expect(organizationStructuredData).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://www.alive.org.tw/#organization',
      name: 'HHC',
      url: 'https://www.alive.org.tw/'
    });
  });

  it('resolves only valid HTTPS structured-data URLs', () => {
    expect(toAbsoluteHttpsUrl('/assets/news.jpg')).toBe('https://www.alive.org.tw/assets/news.jpg');
    expect(toAbsoluteHttpsUrl('http://example.com/news.jpg')).toBeUndefined();
    expect(toAbsoluteHttpsUrl('javascript:alert(1)')).toBeUndefined();
    expect(toAbsoluteHttpsUrl('https://[invalid')).toBeUndefined();
  });
});
