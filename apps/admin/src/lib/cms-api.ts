import {
  createHhcWebClient,
  HhcWebApiError,
  type BulletinIssue,
  type BulletinLocale,
  type BulletinStatus,
  type CompleteBulletinUploadInput,
  type CreatedBulletinUpload,
  type HhcWebClient,
  type PageMeta,
  type UploadTarget,
} from '@hhc/hhc-web-client'

import type { Fetcher } from './api'

export { HhcWebApiError as CmsApiError }
export type {
  BulletinIssue,
  BulletinLocale,
  BulletinStatus,
  CompleteBulletinUploadInput,
  CreatedBulletinUpload,
  PageMeta,
  UploadTarget,
}

export class CmsApi {
  private readonly client: HhcWebClient

  constructor(options: { baseUrl: string; fetcher?: Fetcher; getAccessToken: () => string | null }) {
    this.client = createHhcWebClient({
      baseUrl: options.baseUrl,
      fetcher: options.fetcher as typeof fetch | undefined,
      getAccessToken: options.getAccessToken,
    })
  }

  listBulletins(params: { page?: number; pageSize?: number; status?: BulletinStatus; signal?: AbortSignal } = {}) {
    return this.client.listAdminBulletins(params)
  }

  getBulletin(id: string, signal?: AbortSignal) {
    return this.client.getAdminBulletin(id, signal)
  }

  createBulletin(issueDate: string, idempotencyKey: string) {
    return this.client.createBulletin(issueDate, idempotencyKey)
  }

  createBulletinUpload(
    id: string,
    input: { locale: BulletinLocale; fileName: string; mimeType: 'application/pdf'; sizeBytes: number },
    idempotencyKey: string,
  ) {
    return this.client.createBulletinUpload(id, input, idempotencyKey)
  }

  completeBulletinUpload(id: string, assetId: string, version: number, input: CompleteBulletinUploadInput) {
    return this.client.completeBulletinUpload(id, assetId, version, input)
  }

  publishBulletin(id: string, version: number, locale: BulletinLocale) {
    return this.client.publishBulletin(id, version, locale)
  }

  unpublishBulletin(id: string, version: number, locale: BulletinLocale) {
    return this.client.unpublishBulletin(id, version, locale)
  }

  uploadFile(target: UploadTarget, file: File, signal?: AbortSignal) {
    return this.client.uploadFile(target, file, signal)
  }
}
