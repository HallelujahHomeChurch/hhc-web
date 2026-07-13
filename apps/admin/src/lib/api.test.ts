import { describe, expect, it, vi } from 'vitest'

import { AdminApi } from './api'

describe('AdminApi request cancellation', () => {
  it('passes the caller signal to user directory requests', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ users: [], total: 0, page: 1, per_page: 20 })))
    const api = new AdminApi({ baseUrl: 'https://account.example.test', fetcher })
    const controller = new AbortController()

    await api.listUsers({ signal: controller.signal })

    expect(fetcher).toHaveBeenCalledWith(
      'https://account.example.test/admin/users',
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})

describe('AdminApi session bootstrap', () => {
  it('returns null only when the host has no usable refresh session', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error_code: 'ACC_AUTH_REFRESH_TOKEN_REQUIRED' }), { status: 400 }))
    const api = new AdminApi({ baseUrl: '/api/account/v1', fetcher })

    await expect(api.refreshAccessToken()).resolves.toBeNull()
  })

  it('surfaces service failures instead of starting a new login', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error_code: 'ACC_INTERNAL' }), { status: 500 }))
    const api = new AdminApi({ baseUrl: '/api/account/v1', fetcher })

    await expect(api.refreshAccessToken()).rejects.toMatchObject({ status: 500 })
  })
})
