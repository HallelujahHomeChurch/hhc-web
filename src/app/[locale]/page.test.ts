import {describe, expect, it} from 'vitest';
import {getHomePageTitle} from './page';

describe('home page metadata', () => {
  it('uses only the site name as the browser title', async () => {
    expect(getHomePageTitle('zh-Hant')).toBe('哈利路亞家教會');
  });
});
