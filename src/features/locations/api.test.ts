import {describe, expect, it} from 'vitest';
import {getLocations} from './api';

describe('getLocations', () => {
  it('returns Google Maps links for each location', () => {
    const locations = getLocations('zh-Hant');

    expect(locations.map((location) => location.mapHref)).toEqual([
      'https://maps.app.goo.gl/fDus6nVswbuhSEAd8',
      'https://maps.app.goo.gl/A1SDTSZC2XLHqkST7'
    ]);
  });

  it('localizes location names and uses English addresses outside Chinese locales', () => {
    expect(getLocations('en')).toEqual(expect.arrayContaining([
      expect.objectContaining({name: 'Taipei Hallelujah Home Church', address: "B1, No. 29, Sec. 3, Ren'ai Rd., Da'an Dist., Taipei City 106675, Taiwan (R.O.C.)."}),
      expect.objectContaining({name: 'Zhongli Hallelujah Home Church', address: '2 F., No. 25, Fuzhou Rd., Zhongli Dist., Taoyuan City 320048, Taiwan (R.O.C.).'})
    ]));
    expect(getLocations('ja').map(({name}) => name)).toEqual(['台北ハレルヤ・ホームチャーチ', '中壢ハレルヤ・ホームチャーチ']);
    expect(getLocations('ko').map(({name}) => name)).toEqual(['타이베이 할렐루야 가정교회', '중리 할렐루야 가정교회']);
    expect(getLocations('ja').map(({address}) => address)).toEqual(getLocations('en').map(({address}) => address));
    expect(getLocations('ko').map(({address}) => address)).toEqual(getLocations('en').map(({address}) => address));
  });
});
