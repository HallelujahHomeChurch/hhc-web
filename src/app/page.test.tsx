import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import RootPage, {dynamic, metadata} from './page';

const request = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  redirect: vi.fn()
}));

vi.mock('next/headers', () => ({
  headers: async () => ({get: (name: string) => request.headers.get(name) ?? null})
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => request.redirect(path)
}));

describe('RootPage', () => {
  beforeEach(() => {
    request.headers.clear();
    request.redirect.mockReset().mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('renders a crawlable selector for every product locale without a language signal', async () => {
    const markup = renderToStaticMarkup(await RootPage());

    expect(markup).toContain('href="/zh-Hant"');
    expect(markup).toContain('href="/zh-Hans"');
    expect(markup).toContain('href="/en"');
    expect(markup).toContain('href="/ja"');
    expect(markup).toContain('href="/ko"');
    expect(markup).toContain('"@type":"WebSite"');
    expect(markup).toContain('哈利路亚家教会');
    expect(markup).toContain('ハレルヤ・ホームチャーチ');
    expect(markup).toContain('할렐루야 가정교회');
    expect(request.redirect).not.toHaveBeenCalled();
  });

  it('publishes root canonical and x-default metadata', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(metadata).toMatchObject({
      title: 'HHC',
      alternates: {
        canonical: '/',
        languages: {'x-default': 'https://www.alive.org.tw/'}
      }
    });
  });

  it('publishes HHC with all localized full names as the website identity', async () => {
    const markup = renderToStaticMarkup(await RootPage());
    const jsonLd = markup.match(
      /<script type="application\/ld\+json">([^<]+)<\/script>/
    )?.[1];

    expect(jsonLd).toBeDefined();
    expect(JSON.parse(jsonLd!)).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'HHC',
          alternateName: [
            '哈利路亞家教會',
            '哈利路亚家教会',
            'Hallelujah Home Church',
            'ハレルヤ・ホームチャーチ',
            '할렐루야 가정교회'
          ]
        },
        {'@type': 'Organization', '@id': 'https://www.alive.org.tw/#organization'}
      ]
    });
    expect(metadata.openGraph).toMatchObject({siteName: 'HHC'});
  });

  it('redirects a Japanese browser to the Japanese home page', async () => {
    request.headers.set('accept-language', 'ja-JP,en;q=0.8');

    await expect(RootPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(request.redirect).toHaveBeenCalledWith('/ja');
  });
});
