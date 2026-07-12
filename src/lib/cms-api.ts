import type { Fetcher } from './api'

export type BulletinLocale = 'zh-Hant' | 'zh-Hans' | 'en'
export type BulletinStatus = 'draft' | 'publishing' | 'published' | 'unpublished' | 'archived'

export type BulletinVersion = {
  id: string
  issueId: string
  locale: BulletinLocale
  title: string
  pdfAssetId: string
  pdfFileName: string
  status: Exclude<BulletinStatus, 'archived'>
  version: number
  publishedAt?: string
}

export type BulletinIssue = {
  id: string
  issueDate: string
  status: BulletinStatus
  version: number
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
  versions: BulletinVersion[]
}

export type PageMeta = { page: number; pageSize: number; total: number }
export type UploadTarget = { url: string; method: string; headers: Record<string, string>; expiresAt: string }
export type CreatedBulletinUpload = { asset: { id: string }; uploadTarget: UploadTarget }
export type CompleteBulletinUploadInput = {
  locale: BulletinLocale
  title: string
  fileName: string
  mimeType: 'application/pdf'
  sizeBytes: number
  checksumSha256: string
}

type Envelope<T> = { data: T; meta: Record<string, unknown>; error: { code: string; message: string } | null }
type RequestOptions = { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal }

export class CmsApiError extends Error {
	status: number
	code: string

	constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'CmsApiError'
		this.status = status
		this.code = code
  }
}

export class CmsApi {
  private readonly baseUrl: string
  private readonly fetcher: Fetcher
  private readonly getAccessToken: () => string | null

  constructor(options: { baseUrl: string; fetcher?: Fetcher; getAccessToken: () => string | null }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.getAccessToken = options.getAccessToken
  }

  listBulletins(params: { page?: number; pageSize?: number; status?: BulletinStatus; signal?: AbortSignal } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.status) query.set('status', params.status)
    return this.request<BulletinIssue[]>(`/admin/bulletins${query.size ? `?${query}` : ''}`, { signal: params.signal })
      .then(({ data, meta }) => ({ data, meta: meta as PageMeta }))
  }

  getBulletin(id: string, signal?: AbortSignal) {
    return this.request<BulletinIssue>(`/admin/bulletins/${encodeURIComponent(id)}`, { signal }).then(({ data }) => data)
  }

  createBulletin(issueDate: string, idempotencyKey: string) {
    return this.request<BulletinIssue>('/admin/bulletins', { method: 'POST', body: { issueDate }, headers: { 'Idempotency-Key': idempotencyKey } }).then(({ data }) => data)
  }

  createBulletinUpload(id: string, input: { locale: BulletinLocale; fileName: string; mimeType: 'application/pdf'; sizeBytes: number }, idempotencyKey: string) {
    return this.request<CreatedBulletinUpload>(`/admin/bulletins/${encodeURIComponent(id)}/upload-sessions`, { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } }).then(({ data }) => data)
  }

  completeBulletinUpload(id: string, assetId: string, version: number, input: CompleteBulletinUploadInput) {
    return this.request<BulletinIssue>(`/admin/bulletins/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}/complete`, { method: 'POST', body: input, headers: { 'If-Match': `"${version}"` } }).then(({ data }) => data)
  }

  publishBulletin(id: string, version: number, locale: BulletinLocale) {
    return this.request<{ id: string; status: string }>(`/admin/bulletins/${encodeURIComponent(id)}/publish`, { method: 'POST', body: { locale }, headers: { 'If-Match': `"${version}"` } }).then(({ data }) => data)
  }

  unpublishBulletin(id: string, version: number, locale: BulletinLocale) {
    return this.request<BulletinIssue>(`/admin/bulletins/${encodeURIComponent(id)}/unpublish`, { method: 'POST', body: { locale }, headers: { 'If-Match': `"${version}"` } }).then(({ data }) => data)
  }

  async uploadFile(target: UploadTarget, file: File, signal?: AbortSignal) {
		const headers = new Headers(target.headers)
		if (!headers.has('Content-Type')) headers.set('Content-Type', file.type || 'application/pdf')
		const response = await this.fetcher(target.url, { method: target.method, headers, body: file, signal })
		if (!response.ok) throw new CmsApiError(response.status, 'upload_failed', 'The file could not be uploaded.')
	}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    const token = this.getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let body: string | undefined
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
    const response = await this.fetcher(`${this.baseUrl}${path}`, { method: options.method ?? 'GET', headers, body, signal: options.signal })
    const envelope = await response.json() as Envelope<T>
    if (!response.ok || envelope.error) {
      throw new CmsApiError(response.status, envelope.error?.code ?? 'request_failed', envelope.error?.message ?? response.statusText)
    }
    return envelope
  }
}
