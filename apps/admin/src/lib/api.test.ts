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
