import {afterEach, describe, expect, it, vi} from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); });

describe('browser bootstrap', () => {
  it('uses the Account authority for the shared session client', async () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNT_SITE_URL', 'https://account.alive.org.tw');
    const fetcher = vi.fn().mockResolvedValue(Response.json({authenticated: false}));
    vi.stubGlobal('fetch', fetcher);
    const {getSharedAccountSessionClient} = await import('./browser-bootstrap');

    await getSharedAccountSessionClient().getSession();

    expect(fetcher).toHaveBeenCalledWith(
      'https://account.alive.org.tw/api/account/v1/session',
      expect.anything()
    );
  });

  it('shares only the public push configuration request', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({data: {vapidPublicKey: 'AQID'}}));
    vi.stubGlobal('fetch', fetcher);
    const {getSharedPushConfig} = await import('./browser-bootstrap');

    await expect(Promise.all([getSharedPushConfig(), getSharedPushConfig()])).resolves.toEqual([
      {vapidPublicKey: 'AQID'}, {vapidPublicKey: 'AQID'}
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
