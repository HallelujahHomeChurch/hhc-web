import {describe, expect, it} from 'vitest';
import {externalBrowserHref, isLineBrowser} from './line-browser-handoff';

describe('LINE browser handoff URL', () => {
  it('detects the LINE browser without matching unrelated agents', () => {
    expect(isLineBrowser('Mozilla/5.0 LINE/15.0.0')).toBe(true);
    expect(isLineBrowser('Mozilla/5.0 line/16.0.0')).toBe(true);
    expect(isLineBrowser('Mozilla/5.0 Safari/605.1.15')).toBe(false);
    expect(isLineBrowser('NOTLINE/15.0')).toBe(false);
  });

  it.each([
    'https://www.alive.org.tw/zh-Hant/news?source=line#article',
    'https://www.alive.org.tw/en/member-videos/11111111-1111-1111-1111-111111111111?t=90#player',
    'https://www.alive.org.tw/ja/terms-of-use',
    'https://www.alive.org.tw/?source=line#language'
  ])('preserves the original destination in %s', original => {
    const destination = new URL(externalBrowserHref(original));
    expect(destination.searchParams.get('openExternalBrowser')).toBe('1');
    destination.searchParams.delete('openExternalBrowser');
    expect(destination.href).toBe(original);
  });

  it('replaces duplicate external-browser flags without following a query destination', () => {
    const destination = new URL(externalBrowserHref('https://www.alive.org.tw/en?openExternalBrowser=0&openExternalBrowser=0&returnTo=https%3A%2F%2Fother.example#section'));
    expect(destination.searchParams.getAll('openExternalBrowser')).toEqual(['1']);
    expect(destination.origin).toBe('https://www.alive.org.tw');
    expect(destination.pathname).toBe('/en');
    expect(destination.searchParams.get('returnTo')).toBe('https://other.example');
    expect(destination.hash).toBe('#section');
  });
});
