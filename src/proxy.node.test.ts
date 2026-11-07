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

  it.each(['Mozilla/5.0 Safari/605.1.15', 'Mozilla/5.0 Chrome/140.0', '', 'facebookexternalhit/1.1', 'facebookexternalhit/1.1;line-poker/1.0', 'line-poker/1.0'])('keeps ordinary browsers and link previews on the original page: %s', userAgent => {
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

 describe('canonical video locale resolution', () => {
  it.each(['zh-Hant','zh-Hans','en','ja','ko'])('rewrites %s without changing the public URL', locale => {
    const response = proxy(new NextRequest('https://www.alive.org.tw/video/FA0AoBO02uU?t=42', {headers: {cookie:`hhc_locale=${locale}`, 'accept-language':'en'}}));
    expect(getRewrittenUrl(response)).toBe(`https://www.alive.org.tw/${locale}/video/FA0AoBO02uU?t=42`);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each([['ja','ja'],['fr','zh-Hant'],['zh-CN','zh-Hans']])('uses browser language %s for a first visitor', (language, locale) => {
    expect(getRewrittenUrl(proxy(new NextRequest('https://www.alive.org.tw/video/FA0AoBO02uU', {headers:{'accept-language':language}})))).toContain(`/${locale}/video/`);
  });
  it('keeps the LINE browser isolated and lets its crawler read metadata', () => {
    expect(getRewrittenUrl(proxy(new NextRequest('https://www.alive.org.tw/video/FA0AoBO02uU?t=9', {headers:{'user-agent':line,'accept-language':'ko'}})))).toBe('https://www.alive.org.tw/line-browser/ko/video/FA0AoBO02uU?t=9');
    expect(getRewrittenUrl(proxy(new NextRequest('https://www.alive.org.tw/video/FA0AoBO02uU', {headers:{'user-agent':'line-poker/1.0'}})))).toContain('/zh-Hant/video/');
  });
  it('preserves old locale intent for the redirect', () => {
    const old = proxy(new NextRequest('https://www.alive.org.tw/ja/member-videos/11111111-1111-1111-1111-111111111111'));
    expect(old.headers.get('set-cookie')).toContain('hhc_locale=ja');

  });
 });

it('retains the validated public video identity in the LINE handoff route', () => {
  const response=proxy(new NextRequest('https://www.alive.org.tw/video/_Ab-012xy9Z?t=9&videoId=forged',{headers:{'user-agent':line}}));
  expect(getRewrittenUrl(response)).toBe('https://www.alive.org.tw/line-browser/zh-Hant/video/_Ab-012xy9Z?t=9&videoId=forged');
});

it('retains a legacy recording identity without accepting arbitrary handoff targets', () => {
  const response=proxy(new NextRequest('https://www.alive.org.tw/en/member-videos/11111111-1111-1111-1111-111111111111',{headers:{'user-agent':line}}));
  expect(getRewrittenUrl(response)).toBe('https://www.alive.org.tw/line-browser/en/recording/11111111-1111-1111-1111-111111111111');
  const invalid=proxy(new NextRequest('https://www.alive.org.tw/video/not-an-id?target=https://outside.test',{headers:{'user-agent':line}}));
  expect(getRewrittenUrl(invalid)).toBe('https://www.alive.org.tw/line-browser/zh-Hant?target=https://outside.test');
});
