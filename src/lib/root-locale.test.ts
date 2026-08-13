import {describe, expect, it} from 'vitest';
import {resolveRootLocale} from './root-locale';

describe('resolveRootLocale', () => {
  it('prefers the shared locale cookie', () => {
    expect(resolveRootLocale('hhc_locale=zh-Hans', 'en-US,en;q=0.9')).toBe('zh-Hans');
    expect(resolveRootLocale('hhc_locale=ja', 'ko-KR,ko;q=0.9')).toBe('ja');
  });

  it('falls back to the ordered accepted languages', () => {
    expect(resolveRootLocale('', 'zh-TW,zh;q=0.9,en;q=0.8')).toBe('zh-Hant');
    expect(resolveRootLocale('', 'zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh-Hans');
    expect(resolveRootLocale('', 'en-US,en;q=0.9')).toBe('en');
    expect(resolveRootLocale('', 'ja-JP,en;q=0.8')).toBe('ja');
    expect(resolveRootLocale('', 'ko-KR,en;q=0.8')).toBe('ko');
  });

  it('returns no locale without a supported user language signal', () => {
    expect(resolveRootLocale('', '')).toBeUndefined();
    expect(resolveRootLocale('', 'fr-FR,fr;q=0.9')).toBeUndefined();
  });

  it('skips unsupported languages before a supported preference', () => {
    expect(resolveRootLocale('', 'fr-FR,ja-JP;q=0.9')).toBe('ja');
  });

  it('honors quality weights and rejected languages', () => {
    expect(resolveRootLocale('', 'ja;q=0,en;q=1')).toBe('en');
    expect(resolveRootLocale('', 'ko;q=0.5,ja;q=0.9')).toBe('ja');
    expect(resolveRootLocale('', 'ja;q=0')).toBeUndefined();
  });

  it('returns no locale for a malformed language header', () => {
    expect(resolveRootLocale('', 'ja;q=garbage')).toBeUndefined();
  });
});
