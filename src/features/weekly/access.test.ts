import {afterEach, describe, expect, it, vi} from 'vitest';
import {getBulletinAccess, isBulletinEnabled} from './access';

const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({captureHandledError}));

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
    expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'bulletin.access_config', level: 'warning'});
    await expect(getBulletinAccess()).rejects.toThrow('unavailable');
  });
});
