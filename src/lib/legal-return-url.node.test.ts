import {expect, it} from 'vitest';
import {legalReturnURL} from './legal-return-url';

it('preserves only supported bulletin content selectors through legal acceptance', () => {
  for (const suffix of [
    '/en/member-videos',
    '/zh-Hant/literature-ministry?series=general&issueNumber=1733&contentLocale=en&mode=online',
    '/ja/literature-ministry?series=children&page=2&mode=pdf',
    '/ja/literature-ministry?series=children&contentLocale=en&mode=online',
    '/ko/literature-ministry/1733/read/children/en'
  ]) {
    const url = `https://www.alive.org.tw${suffix}`;
    expect(legalReturnURL(url)).toBe(url);
  }
  for (const suffix of [
    '/en/member-videos?token=secret',
    '/en/literature-ministry?issueNumber=1733',
    '/en/literature-ministry?series=children&issueNumber=1733&contentLocale=zh-Hans',
    '/en/literature-ministry?series=general&series=children',
    '/en/literature-ministry?series=general&issueNumber=2147483648&contentLocale=en',
    '/en/literature-ministry?series=general&issueNumber=01733&contentLocale=en',
    '/en/literature-ministry?return_to=https://evil.test',
    '/en/literature-ministry?accountId=someone',
    '/en/literature-ministry?__proto__=general',
    '/en/literature-ministry/1733/read/children/zh-Hans',
    '/en/literature-ministry/1733/read/general/en?token=secret',
    '/en/literature-ministry/1733/read/general/en#secret'
  ]) expect(legalReturnURL(`https://www.alive.org.tw${suffix}`)).toBeUndefined();
  for (const url of ['https://evil.test/en/literature-ministry', 'https://user@www.alive.org.tw/en/literature-ministry', '//www.alive.org.tw/en/literature-ministry']) expect(legalReturnURL(url)).toBeUndefined();
});
