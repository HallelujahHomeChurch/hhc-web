import {describe, expect, it} from 'vitest';
import {externalBrowserHref, isLineBrowser} from './LineBrowserNotice';
import {isStatementSuppressedPath} from '@/features/statements/visibility';

describe('LINE browser handoff', () => {
  it('detects LINE without affecting ordinary browsers', () => {
    expect(isLineBrowser('Mozilla/5.0 LINE/15.0.0')).toBe(true);
    expect(isLineBrowser('Mozilla/5.0 Safari/605.1.15')).toBe(false);
  });

  it('preserves path, query, and hash while replacing an existing LINE parameter', () => {
    expect(externalBrowserHref('https://www.alive.org.tw/zh-Hant/news?openExternalBrowser=0&item=1#story'))
      .toBe('https://www.alive.org.tw/zh-Hant/news?openExternalBrowser=1&item=1#story');
  });

  it('uses the same three pathname exclusions as statements', () => {
    for (const page of ['maintenance', 'privacy-policy', 'terms-of-use']) {
      expect(isStatementSuppressedPath(`/zh-Hant/${page}`)).toBe(true);
    }
    expect(isStatementSuppressedPath('/zh-Hant/news')).toBe(false);
  });
});
