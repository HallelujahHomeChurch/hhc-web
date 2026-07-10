import { describe, expect, it, vi } from 'vitest'

import { AdminApi } from './api'

describe('AdminApi', () => {
  it('exchanges an authorization code with form-encoded PKCE parameters', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ access_token: 'access' })))
    const api = new AdminApi({
      baseUrl: 'https://admin.alive.org.tw/api/account/v1',
      fetcher,
    })

    const response = await api.exchangeCode({
      code: 'code',
      codeVerifier: 'verifier',
      clientId: 'admin-web',
      redirectUri: 'https://admin.alive.org.tw/oauth/callback',
    })

    expect(response.access_token).toBe('access')
    expect(fetcher).toHaveBeenCalledWith(
      'https://admin.alive.org.tw/api/account/v1/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    )
  })

  it('throws typed API errors', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ error_code: 'ACC_FORBIDDEN', message: 'Forbidden' }),
      { status: 403 },
    ))
    const api = new AdminApi({ baseUrl: '/api/account/v1', fetcher })

    await expect(api.me()).rejects.toMatchObject({
      status: 403,
      code: 'ACC_FORBIDDEN',
      message: 'Forbidden',
    })
  })
})
