import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {describe, expect, it} from 'vitest';
import {getLocations} from './api';

describe('getLocations', () => {
  it('maps published locations to the public website model', async () => {
    const client = {
      listLocations: async () => [{
        id: 'taipei',
        name: '台北哈利路亞家教會',
        address: '地址',
        mapHref: 'https://maps.app.goo.gl/fDus6nVswbuhSEAd8',
        sortOrder: 10,
        resolvedLocale: 'zh-Hant' as const,
        availableLocales: ['zh-Hant' as const]
      }]
    } as unknown as HhcWebClient;

    await expect(getLocations('zh-Hant', client)).resolves.toEqual([{
      id: 'taipei',
      name: '台北哈利路亞家教會',
      address: '地址',
      mapHref: 'https://maps.app.goo.gl/fDus6nVswbuhSEAd8'
    }]);
  });

  it.each([
    ['zh-Hant', '台北哈利路亞家教會', '106臺北市大安區民輝里仁愛路三段29號B1'],
    ['zh-Hans', '台北哈利路亚家教会', '106台北市大安区民辉里仁爱路三段29号B1'],
    ['en', 'Taipei Hallelujah Home Church', "B1, No. 29, Sec. 3, Ren'ai Rd., Da'an Dist., Taipei City 106675, Taiwan (R.O.C.)."],
    ['ja', '台北ハレルヤ・ホームチャーチ', "B1, No. 29, Sec. 3, Ren'ai Rd., Da'an Dist., Taipei City 106675, Taiwan (R.O.C.)."],
    ['ko', '타이베이 할렐루야 가정교회', "B1, No. 29, Sec. 3, Ren'ai Rd., Da'an Dist., Taipei City 106675, Taiwan (R.O.C.)."]
  ] as const)('preserves the %s CMS values', async (locale, name, address) => {
    const client = {
      listLocations: async (requestedLocale: typeof locale) => [{
        id: 'taipei',
        name: requestedLocale === locale ? name : 'wrong locale',
        address,
        mapHref: 'https://maps.app.goo.gl/fDus6nVswbuhSEAd8',
        sortOrder: 10,
        resolvedLocale: locale,
        availableLocales: ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko']
      }]
    } as unknown as HhcWebClient;

    await expect(getLocations(locale, client)).resolves.toEqual([{
      id: 'taipei',
      name,
      address,
      mapHref: 'https://maps.app.goo.gl/fDus6nVswbuhSEAd8'
    }]);
  });

  it('uses the existing localized locations while the CMS request fails', async () => {
    const client = {listLocations: async () => Promise.reject(new Error('unavailable'))} as unknown as HhcWebClient;

    await expect(getLocations('ja', client)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({name: '台北ハレルヤ・ホームチャーチ'}),
      expect.objectContaining({name: '中壢ハレルヤ・ホームチャーチ'})
    ]));
  });
});
