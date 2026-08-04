import {describe, expect, it} from 'vitest';
import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';

describe('legal content', () => {
  it.each([
    ['zh-Hant', zhHant],
    ['zh-Hans', zhHans],
    ['en', en]
  ])('discloses account protections in %s', (_locale, messages) => {
    const privacy = JSON.stringify(messages.privacyPolicy);
    const terms = JSON.stringify(messages.termsOfUse);

    expect(privacy).toContain('Google');
    expect(privacy).toContain('Microsoft');
    expect(privacy).toContain('LINE');
    expect(privacy).toContain('Gmail');
    expect(privacy).toContain('support@alive.org.tw');
    expect(terms).toContain('support@alive.org.tw');
  });

  it('states the implemented retention periods', () => {
    expect(JSON.stringify(zhHant.privacyPolicy)).toContain('7 天');
    expect(JSON.stringify(zhHant.privacyPolicy)).toContain('180 天');
    expect(JSON.stringify(en.privacyPolicy)).toContain('7 days');
    expect(JSON.stringify(en.privacyPolicy)).toContain('180 days');
  });
});
