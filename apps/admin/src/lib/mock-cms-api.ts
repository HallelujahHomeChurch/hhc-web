import type {
  BulletinIssue,
  BulletinLocale,
  BulletinStatus,
  CompleteBulletinUploadInput,
  ContentItem,
  ContentModule,
  ContentStatus,
  ContentWriteInput,
  CreatedBulletinUpload,
  UploadTarget,
} from './cms-api'

const now = new Date().toISOString()
const bulletins: BulletinIssue[] = [
  {
    id: 'bulletin-2026-07-13', issueDate: '2026-07-13', status: 'draft', version: 2, createdAt: now, updatedAt: now,
    createdBy: 'admin-1', updatedBy: 'admin-1',
    versions: [{ id: 'version-1', issueId: 'bulletin-2026-07-13', locale: 'zh-Hant', title: '2026-07-13 週報', pdfAssetId: 'asset-1', pdfFileName: 'weekly-2026-07-13.pdf', status: 'draft', version: 1, createdAt: now, updatedAt: now }],
  },
  {
    id: 'bulletin-2026-07-06', issueDate: '2026-07-06', status: 'published', version: 3, publishedAt: now, createdAt: now, updatedAt: now,
    createdBy: 'admin-1', updatedBy: 'admin-1',
    versions: [{ id: 'version-2', issueId: 'bulletin-2026-07-06', locale: 'zh-Hant', title: '2026-07-06 週報', pdfAssetId: 'asset-2', pdfFileName: 'weekly-2026-07-06.pdf', status: 'published', version: 2, publishedAt: now, createdAt: now, updatedAt: now }],
  },
]

const contentItems: ContentItem[] = [
  { id: 'news-1', module: 'news', status: 'draft', version: 1, slug: 'summer-gathering', displayDate: '2026-07-13', coverAssetId: '', featured: true, translations: [{ locale: 'zh-Hant', title: '夏季聚會', summary: '一起參與夏季聚會。', body: '活動內容', imageAlt: '夏季聚會' }], createdBy: 'admin-1', updatedBy: 'admin-1', createdAt: now, updatedAt: now },
  { id: 'history-1', module: 'history', status: 'published', version: 2, sortOrder: 10, translations: [{ locale: 'zh-Hant', title: '教會獻堂', dateLabel: '1990年9月2日', body: '哈利路亞家教會獻堂。' }], createdBy: 'admin-1', updatedBy: 'admin-1', createdAt: now, updatedAt: now },
  { id: 'video-1', module: 'videos', status: 'published', version: 2, youtubeVideoId: 'K3ckFWeSQ-k', homeEligible: true, translations: [{ locale: 'zh-Hant', title: '為祢而闖', imageAlt: '為祢而闖' }], createdBy: 'admin-1', updatedBy: 'admin-1', createdAt: now, updatedAt: now },
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
    const issue: BulletinIssue = { id: `bulletin-${issueDate}`, issueDate, status: 'draft', version: 1, createdBy: 'admin-1', updatedBy: 'admin-1', createdAt: now, updatedAt: now, versions: [] }
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
    const next = { id: existing?.id ?? `version-${assetId}`, issueId: id, locale: input.locale, title: input.title, pdfAssetId: assetId, pdfFileName: input.fileName, status: 'draft' as const, version: (existing?.version ?? 0) + 1, createdAt: existing?.createdAt ?? now, updatedAt: now }
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
  async listContent(module: ContentModule, params: { page?: number; pageSize?: number; status?: ContentStatus } = {}) {
    const filtered = contentItems.filter((item) => item.module === module && (!params.status || item.status === params.status))
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    return { data: structuredClone(filtered.slice((page - 1) * pageSize, page * pageSize)), meta: { page, pageSize, total: filtered.length } }
  }
  async getContent(module: ContentModule, id: string) { return structuredClone(findContent(module, id)) }
  async createContent(module: ContentModule, input: ContentWriteInput) {
    const item: ContentItem = { ...structuredClone(input), id: `${module}-${crypto.randomUUID()}`, module, status: 'draft', version: 1, createdBy: 'admin-1', updatedBy: 'admin-1', createdAt: now, updatedAt: now }
    contentItems.unshift(item)
    return structuredClone(item)
  }
  async updateContent(module: ContentModule, id: string, version: number, input: ContentWriteInput) {
    const item = findContent(module, id)
    if (item.version !== version) throw new Error('precondition_failed')
    Object.assign(item, structuredClone(input), { status: 'draft', version: item.version + 1, updatedAt: now })
    return structuredClone(item)
  }
  async publishContent(module: ContentModule, id: string, version: number) { return this.changeContentStatus(module, id, version, 'published') }
  async unpublishContent(module: ContentModule, id: string, version: number) { return this.changeContentStatus(module, id, version, 'unpublished') }
  async listContentRevisions(module: ContentModule, id: string) { const item = findContent(module, id); return [{ version: item.version, snapshot: structuredClone(item), createdBy: item.updatedBy, createdAt: item.updatedAt }] }
  async restoreContentRevision(module: ContentModule, id: string, _revision: number, version: number) { return this.changeContentStatus(module, id, version, 'draft') }
  private async changeContentStatus(module: ContentModule, id: string, version: number, status: ContentStatus) { const item = findContent(module, id); if (item.version !== version) throw new Error('precondition_failed'); item.status = status; item.version++; item.updatedAt = now; return structuredClone(item) }
}

function findBulletin(id: string) {
  const issue = bulletins.find((item) => item.id === id)
  if (!issue) throw new Error('Bulletin not found')
  return issue
}
function findContent(module: ContentModule, id: string) {
  const item = contentItems.find((value) => value.module === module && value.id === id)
  if (!item) throw new Error('Content not found')
  return item
}
