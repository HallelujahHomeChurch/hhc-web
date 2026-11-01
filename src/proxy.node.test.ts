import {describe, expect, it} from 'vitest';
import {NextRequest} from 'next/server';
import {getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch} from 'next/experimental/testing/server';
import {config, proxy} from './proxy';

const line = 'Mozilla/5.0 (iPhone) LINE/15.0.0';

describe('LINE browser routing', () => {
  it.each(['/', '/zh-Hant/news', '/zh-Hans/privacy-policy', '/en/member-videos/recording', '/ja/terms-of-use', '/ko'])('intercepts the page %s before its original route renders', path => {
    expect(unstable_doesMiddlewareMatch({config, nextConfig: {}, url: path})).toBe(true);
    const response = proxy(new NextRequest(`https://www.alive.org.tw${path}?source=line`, {headers: {'user-agent': line}}));
    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe(`https://www.alive.org.tw/line-browser/${path.split('/')[1] || 'zh-Hant'}?source=line`);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it.each(['/api/account/v1/session', '/health', '/assets/brand/logo.png', '/_next/static/app.js', '/_next/image', '/line-browser/en', '/oauth/callback', '/robots.txt', '/sitemap.xml', '/invalid/news'])('leaves %s outside the handoff', url => {
    expect(unstable_doesMiddlewareMatch({config, nextConfig: {}, url})).toBe(false);
  });

  it.each(['Mozilla/5.0 Safari/605.1.15', 'Mozilla/5.0 Chrome/140.0', '', 'facebookexternalhit/1.1'])('keeps ordinary browsers and link previews on the original page: %s', userAgent => {
    const response = proxy(new NextRequest('https://www.alive.org.tw/en/news?openExternalBrowser=1', {headers: {'user-agent': userAgent}}));
    expect(isRewrite(response)).toBe(false);
  });

  it('keeps LINE gated even when the external browser parameter is already present', () => {
    expect(isRewrite(proxy(new NextRequest('https://www.alive.org.tw/en?openExternalBrowser=1', {headers: {'user-agent': line}})))).toBe(true);
  });

  it('does not rewrite a non-navigation submission', () => {
    expect(isRewrite(proxy(new NextRequest('https://www.alive.org.tw/en', {method: 'POST', headers: {'user-agent': line}})))).toBe(false);
  });

  it('uses the existing language preference for a neutral-root handoff', () => {
    const response = proxy(new NextRequest('https://www.alive.org.tw/?source=line', {headers: {'user-agent': line, 'accept-language': 'ja'}}));
    expect(getRewrittenUrl(response)).toBe('https://www.alive.org.tw/line-browser/ja?source=line');
  });
});
