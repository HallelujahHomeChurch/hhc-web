import {afterEach, describe, expect, it, vi} from 'vitest';
import {getBulletinAccess, isBulletinEnabled} from './access';

afterEach(() => vi.unstubAllGlobals());
describe('bulletin access', () => {
  it('reads each request using no-store and preserves disabled', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({data: {enabled: false}, error: null})));
    vi.stubGlobal('fetch', fetcher);
    expect(await getBulletinAccess()).toEqual({enabled: false});
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({url: expect.stringContaining('/bulletin-access')}), expect.objectContaining({cache: 'no-store'}));
  });
  it('hides entry points on failure but leaves strict reads rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('unavailable')));
    expect(await isBulletinEnabled()).toBe(false);
    await expect(getBulletinAccess()).rejects.toThrow('unavailable');
  });
});
