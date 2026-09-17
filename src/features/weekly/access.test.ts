import {afterEach, describe, expect, it, vi} from 'vitest';
import {getBulletinAccess, isBulletinEnabled} from './access';

afterEach(() => vi.unstubAllGlobals());
describe('bulletin access', () => {
  it('keeps public bulletin access closed without calling the removed public switch', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await getBulletinAccess()).toEqual({enabled: false});
    expect(await isBulletinEnabled()).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
