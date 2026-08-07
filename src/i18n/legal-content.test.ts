import {describe, expect, it} from 'vitest';
import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';

describe('legal content', () => {
  it.each([
    ['zh-Hant', zhHant],
    ['zh-Hans', zhHans],
    ['en', en]
  ])('publishes an account help page for OAuth review in %s', (_locale, messages) => {
    const accountHelp = JSON.stringify(messages.accountHelp);

    expect(accountHelp).toContain('Google');
    expect(accountHelp).toContain('support@alive.org.tw');
    expect(accountHelp).toMatch(/privacy-policy|隱私權|隐私权|Privacy/);
  });

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

  it.each([
    ['zh-Hant', zhHant],
    ['zh-Hans', zhHans],
    ['en', en]
  ])('discloses optional newsletter and browser notification consent in %s', (_locale, messages) => {
    const privacy = JSON.stringify(messages.privacyPolicy).toLowerCase();

    expect(privacy).toMatch(/電子報|电子报|newsletter/);
    expect(privacy).toMatch(/瀏覽器通知|浏览器通知|browser notification/);
    expect(privacy).toMatch(/取消訂閱|取消订阅|unsubscribe/);
  });
});
