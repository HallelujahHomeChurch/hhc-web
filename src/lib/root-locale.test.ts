import {describe, expect, it} from 'vitest';
import {resolveRootLocale} from './root-locale';

describe('resolveRootLocale', () => {
  it('prefers the shared locale cookie', () => {
    expect(resolveRootLocale('hhc_locale=zh-Hans', 'en-US,en;q=0.9')).toBe('zh-Hans');
  });

  it('falls back to the ordered accepted languages', () => {
    expect(resolveRootLocale('', 'zh-TW,zh;q=0.9,en;q=0.8')).toBe('zh-Hant');
  });
});
