import {createHhcWebClient, type OnlineBulletinAccess, type BulletinReaderMutation} from '@hallelujahhomechurch/hhc-web-client';
import {requireBulletinRenderer, type BulletinRenderableDocument} from '@hallelujahhomechurch/ui';
import type {BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';
import {createProtectedFetch} from '@/features/weekly/api';
import assets from '../../../public/assets/weekly/v1/manifest.json';
import {verifyPrivateState} from './private-state';

export type ReaderSelector = {accountId: string; issueNumber: number; series: BulletinSeries; contentLocale: BulletinLocale};
type Authorization = Parameters<typeof createProtectedFetch>[0];
const hash = /^[0-9a-f]{64}$/;

export function verifyReaderAccess(value: OnlineBulletinAccess, expected: ReaderSelector): BulletinRenderableDocument {
  const {document, access} = value;
  const content = document.content;
  if (access.accountId !== expected.accountId ||
      document.series !== expected.series || document.contentLocale !== expected.contentLocale ||
      access.documentId !== document.documentId || access.series !== document.series || access.contentLocale !== document.contentLocale ||
      access.revision !== document.revision || !Number.isSafeInteger(document.revision) || document.revision < 1 || access.currentRevision < access.revision ||
      !access.receiptId || !access.traceCode || !Number.isFinite(Date.parse(access.validatedAt)) ||
      Date.parse(access.offlineValidUntil) - Date.parse(access.validatedAt) !== 604800000) throw new Error('invalid_reader_binding');
  requireBulletinRenderer(content.layoutManifest);
  if (document.series !== 'general' || document.contentLocale !== 'zh-Hant' || content.schemaVersion !== '1' || content.templateVersion !== 'v1' ||
      !hash.test(content.layoutManifest.contentHash ?? '') || !hash.test(content.layoutManifest.layoutValidationHash ?? '') ||
      !Number.isInteger(content.printedBodyPageCount) || content.printedBodyPageCount < 2 || content.printedBodyPageCount > 38 ||
      !content.pages.length || content.pages.length > 80 || content.layoutManifest.pages.length !== content.pages.length) throw new Error('update_required');
  for (const asset of content.layoutManifest.assets) {
    if (!assets.assets.some(known => known.url === asset.url && known.sha256 === asset.sha256 && known.kind === asset.kind)) throw new Error('update_required');
  }
  const pageIds = new Set<string>();
  for (const page of content.pages) {
    if (pageIds.has(page.id) || !Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width <= 0 || page.height <= 0 ||
        content.layoutManifest.pages.filter(layout => layout.pageId === page.id).length !== 1) throw new Error('invalid_layout');
    pageIds.add(page.id);
  }
  // The worker proof binds its original document; the client already checked the
  // exact response-byte SHA-256. Never hash the redacted projection as that proof.
  return {...content, contentLocale: 'zh-Hant', sourcePageCount: content.printedBodyPageCount + 2};
}

export function createReaderApi(authorization: Authorization, fetcher = globalThis.fetch.bind(globalThis)) {
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => null, fetcher: createProtectedFetch(authorization, fetcher)});
  return {
    async privateState(selector: ReaderSelector, value: OnlineBulletinAccess, signal?: AbortSignal) {
      verifyReaderAccess(value, selector);
      const response = await client.getReaderState({issueId: value.document.issueId, series: selector.series, locale: selector.contentLocale, fromRevision: value.document.revision, signal});
      signal?.throwIfAborted();
      verifyPrivateState(response.state, selector.accountId, value.document.documentId, value.document.revision);
      return response;
    },
    async mutate(selector: ReaderSelector, value: OnlineBulletinAccess, mutations: BulletinReaderMutation[], signal?: AbortSignal) {
      verifyReaderAccess(value, selector);
      const response = await client.applyReaderMutations({issueId: value.document.issueId, series: selector.series, locale: selector.contentLocale, mutations, signal});
      signal?.throwIfAborted();
      verifyPrivateState(response.state, selector.accountId, value.document.documentId, value.document.revision);
      if (response.results.length !== mutations.length || response.results.some((result, index) => result.mutationId !== mutations[index].mutationId)) throw new Error('invalid_reader_binding');
      return response;
    },
    async renew(selector: ReaderSelector, saved: OnlineBulletinAccess, clientRequestId: string, signal?: AbortSignal) {
      verifyReaderAccess(saved, selector);
      const value = await client.openOnlineBulletin({issueId: saved.document.issueId, series: selector.series, locale: selector.contentLocale,
        revision: saved.access.revision, receiptId: saved.access.receiptId, clientRequestId, signal});
      signal?.throwIfAborted();
      if (value.document.issueId !== saved.document.issueId || value.document.documentId !== saved.document.documentId || value.access.revision !== saved.access.revision) throw new Error('invalid_reader_binding');
      verifyReaderAccess(value, selector);
      return value;
    },
    async open(selector: ReaderSelector, request: {clientRequestId: string; revision?: number; receiptId?: string}, signal?: AbortSignal) {
      const found = await client.listOnlineBulletinDiscovery({series: selector.series, locale: selector.contentLocale, offset: 0, limit: 1, issueNumber: selector.issueNumber, signal});
      signal?.throwIfAborted();
      const edition = found.items.find(item => item.issueNumber === selector.issueNumber && item.series === selector.series && item.contentLocale === selector.contentLocale && item.onlineRevision);
      if (!edition) throw new Error('unavailable');
      const value = await client.openOnlineBulletin({issueId: edition.issueId, series: selector.series, locale: selector.contentLocale, ...request, signal});
      signal?.throwIfAborted();
      if (value.document.issueId !== edition.issueId) throw new Error('invalid_reader_binding');
      verifyReaderAccess(value, selector);
      return value;
    }
  };
}
