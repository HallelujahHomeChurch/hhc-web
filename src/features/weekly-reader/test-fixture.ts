import type {OnlineBulletinAccess} from '@hallelujahhomechurch/hhc-web-client';
import {BULLETIN_RENDERER_V1_DIGEST} from '@hallelujahhomechurch/ui';
import assets from '../../../public/assets/weekly/v1/manifest.json';

export function readerFixture(): OnlineBulletinAccess {
  const issueId = '00000000-0000-4000-8000-000000000001';
  const documentId = '00000000-0000-4000-8000-000000000002';
  return {
    document: {issueId, documentId, series: 'general', contentLocale: 'zh-Hant', revision: 1, canonicalMetadata: {title: 'Private weekly', subtitle: '', issueNumber: 1739, date: '2026-09-20'}, metadataSyncPending: false, pdfPublished: false,
      content: {schemaVersion: '1', templateVersion: 'v1', printedBodyPageCount: 10,
        pages: Array.from({length: 4}, (_, i) => ({id: `p${i}`, width: 595.32, height: 841.92})),
        layoutManifest: {templateVersion: 'v1', rendererVersion: 'v1', rendererArtifactSha256: BULLETIN_RENDERER_V1_DIGEST, contentHash: 'a'.repeat(64), layoutValidationHash: 'b'.repeat(64), assets: assets.assets.filter(a => a.kind !== 'license').map(a => ({url: a.url, sha256: a.sha256, kind: a.kind as 'font' | 'decoration'})), pages: Array.from({length: 4}, (_, i) => ({pageId: `p${i}`, slots: [{id: `slot${i}`, componentId: `c${i}`, blockId: `b${i}`, box: {x: .1, y: .1, width: .8, height: .1}, fragments: [{sentenceId: `s${i}`, start: 0, end: 4}]}]}))},
        components: Array.from({length: 4}, (_, i) => ({id: `c${i}`, type: 'backSummary' as const, items: [{id: `i${i}`, blocks: [{id: `b${i}`, style: {fontSize: 16, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}, sentences: [{id: `s${i}`, spans: [{text: `內容${i}。`, fontRole: 'body' as const}]}]}]}]}))}},
    access: {accountId: 'account-a', documentId, series: 'general', contentLocale: 'zh-Hant', revision: 1, currentRevision: 1, receiptId: 'receipt-a', traceCode: 'ABCD-EFGH-JKLM', validatedAt: '2026-10-01T00:00:00Z', offlineValidUntil: '2026-10-08T00:00:00Z'}
  };
}
