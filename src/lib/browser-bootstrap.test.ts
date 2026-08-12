import {afterEach, describe, expect, it, vi} from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('browser bootstrap sharing', () => {
  it('shares account session and push config requests across remounts', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/session')
      ? Response.json({authenticated: false})
      : Response.json({data: {vapidPublicKey: 'AQID'}}));
    vi.stubGlobal('fetch', fetcher);
    const {getSharedAccountSessionClient, getSharedPushConfig} = await import('./browser-bootstrap');

    await Promise.all([
      getSharedAccountSessionClient().getSession(),
      getSharedAccountSessionClient().getSession(),
      getSharedPushConfig(),
      getSharedPushConfig()
    ]);

    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/session'))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/push/config'))).toHaveLength(1);
  });

  it('revalidates session explicitly and retries rejected push config', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({authenticated: false}))
      .mockResolvedValueOnce(new Response(null, {status: 503}))
      .mockResolvedValueOnce(Response.json({data: {vapidPublicKey: 'AQID'}}))
      .mockResolvedValueOnce(Response.json({authenticated: false}));
    vi.stubGlobal('fetch', fetcher);
    const {getSharedAccountSessionClient, getSharedPushConfig, revalidateSharedAccountSession} = await import('./browser-bootstrap');

    await getSharedAccountSessionClient().getSession();
    await expect(getSharedPushConfig()).rejects.toThrow();
    await expect(getSharedPushConfig()).resolves.toEqual({vapidPublicKey: 'AQID'});
    await revalidateSharedAccountSession();

    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
