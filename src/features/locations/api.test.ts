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
});
