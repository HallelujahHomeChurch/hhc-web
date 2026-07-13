import { describe, expect, it, vi } from 'vitest'

import { CmsApi, CmsApiError } from './cms-api'

describe('CmsApi', () => {
  it('lists bulletin issues with bearer auth and pagination', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'issue-1', issueDate: '2026-07-13', status: 'draft', version: 1, versions: [] }],
      meta: { page: 2, pageSize: 20, total: 41 },
      error: null,
    }), { status: 200 }))
    const api = new CmsApi({ baseUrl: 'https://www.alive.org.tw/api/', fetcher, getAccessToken: () => 'access-token' })

    const result = await api.listBulletins({ page: 2, pageSize: 20, status: 'draft' })

    expect(result.meta.total).toBe(41)
    const request = fetcher.mock.calls[0][0] as Request
    expect(request.url).toBe('https://www.alive.org.tw/api/admin/bulletins?page=2&pageSize=20&status=draft')
    expect(request.headers.get('Authorization')).toBe('Bearer access-token')
  })

  it('sends optimistic concurrency and idempotency headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'issue-1', issueDate: '2026-07-13', status: 'draft', version: 2, versions: [] },
      meta: {},
      error: null,
    }), { status: 200 }))
    const api = new CmsApi({ baseUrl: '/api', fetcher, getAccessToken: () => 'token' })

    await api.completeBulletinUpload('issue-1', 'asset-1', 1, {
      locale: 'zh-Hant', title: '週報', fileName: 'weekly.pdf', mimeType: 'application/pdf', sizeBytes: 128, checksumSha256: 'a'.repeat(64),
    })

    const request = fetcher.mock.calls[0][0] as Request
    expect(request.headers.get('If-Match')).toBe('"1"')
    expect(request.headers.get('Content-Type')).toBe('application/json')
  })

  it('surfaces the API error code', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: null,
      meta: {},
      error: { code: 'version_conflict', message: 'The resource changed.' },
    }), { status: 412 }))
    const api = new CmsApi({ baseUrl: '/api', fetcher, getAccessToken: () => 'token' })

		await expect(api.publishBulletin('issue-1', 2, 'zh-Hant')).rejects.toMatchObject({
      status: 412,
      code: 'version_conflict',
		} satisfies Partial<CmsApiError>)
  })
})
