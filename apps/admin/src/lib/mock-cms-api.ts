import type {
  BulletinIssue,
  BulletinLocale,
  BulletinStatus,
  CompleteBulletinUploadInput,
  CreatedBulletinUpload,
  UploadTarget,
} from './cms-api'

const now = new Date().toISOString()
const bulletins: BulletinIssue[] = [
  {
    id: 'bulletin-2026-07-13', issueDate: '2026-07-13', status: 'draft', version: 2, createdAt: now, updatedAt: now,
    versions: [{ id: 'version-1', issueId: 'bulletin-2026-07-13', locale: 'zh-Hant', title: '2026-07-13 週報', pdfAssetId: 'asset-1', pdfFileName: 'weekly-2026-07-13.pdf', status: 'draft', version: 1 }],
  },
  {
    id: 'bulletin-2026-07-06', issueDate: '2026-07-06', status: 'published', version: 3, publishedAt: now, createdAt: now, updatedAt: now,
    versions: [{ id: 'version-2', issueId: 'bulletin-2026-07-06', locale: 'zh-Hant', title: '2026-07-06 週報', pdfAssetId: 'asset-2', pdfFileName: 'weekly-2026-07-06.pdf', status: 'published', version: 2, publishedAt: now }],
  },
]

export class MockCmsApi {
  async listBulletins(params: { page?: number; pageSize?: number; status?: BulletinStatus; signal?: AbortSignal } = {}) {
    const filtered = params.status ? bulletins.filter((item) => item.status === params.status) : bulletins
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const start = (page - 1) * pageSize
    return { data: structuredClone(filtered.slice(start, start + pageSize)), meta: { page, pageSize, total: filtered.length } }
  }
  async getBulletin(id: string) {
    return structuredClone(findBulletin(id))
  }
  async createBulletin(issueDate: string) {
    const existing = bulletins.find((item) => item.issueDate === issueDate)
    if (existing) return structuredClone(existing)
    const issue: BulletinIssue = { id: `bulletin-${issueDate}`, issueDate, status: 'draft', version: 1, createdAt: now, updatedAt: now, versions: [] }
    bulletins.unshift(issue)
    return structuredClone(issue)
  }
  async createBulletinUpload(id: string, input: { locale: BulletinLocale }, _key: string): Promise<CreatedBulletinUpload> {
    findBulletin(id)
    return { asset: { id: `asset-${id}-${input.locale}` }, uploadTarget: { url: 'mock://upload', method: 'PUT', headers: {}, expiresAt: now } }
  }
  async uploadFile(_target: UploadTarget, _file: File) {}
  async completeBulletinUpload(id: string, assetId: string, version: number, input: CompleteBulletinUploadInput) {
    const issue = findBulletin(id)
    if (issue.version !== version) throw new Error('version_conflict')
    const existing = issue.versions.find((item) => item.locale === input.locale)
    const next = { id: existing?.id ?? `version-${assetId}`, issueId: id, locale: input.locale, title: input.title, pdfAssetId: assetId, pdfFileName: input.fileName, status: 'draft' as const, version: (existing?.version ?? 0) + 1 }
    issue.versions = [...issue.versions.filter((item) => item.locale !== input.locale), next]
    issue.status = 'draft'
    issue.version++
    return structuredClone(issue)
  }
  async publishBulletin(id: string, version: number, locale: BulletinLocale) {
    const issue = findBulletin(id)
    if (issue.version !== version) throw new Error('version_conflict')
    const localized = issue.versions.find((item) => item.locale === locale)
    if (!localized) throw new Error('not_publishable')
    issue.version++
    issue.status = 'published'
    issue.publishedAt = now
    localized.status = 'published'
    localized.publishedAt = now
    return { id: `workflow-${id}-${locale}`, status: 'completed' }
  }
  async unpublishBulletin(id: string, version: number, locale: BulletinLocale) {
    const issue = findBulletin(id)
    if (issue.version !== version) throw new Error('version_conflict')
    const localized = issue.versions.find((item) => item.locale === locale)
    if (!localized) throw new Error('not_publishable')
    localized.status = 'unpublished'
    issue.version++
    issue.status = issue.versions.some((item) => item.status === 'published') ? 'published' : 'unpublished'
    return structuredClone(issue)
  }
}

function findBulletin(id: string) {
  const issue = bulletins.find((item) => item.id === id)
  if (!issue) throw new Error('Bulletin not found')
  return issue
}
