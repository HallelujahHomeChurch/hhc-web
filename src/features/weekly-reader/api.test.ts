import {beforeEach, describe, expect, it, vi} from 'vitest';
import {readerFixture} from './test-fixture';
import {createReaderApi, verifyReaderAccess} from './api';
import {BULLETIN_RENDERER_V2_DIGEST,BULLETIN_RENDERER_V2_ASSETS} from '@hallelujahhomechurch/ui';

const client = vi.hoisted(() => ({listOnlineBulletinDiscovery: vi.fn(), openOnlineBulletin: vi.fn(), getReaderState: vi.fn(), applyReaderMutations: vi.fn()}));
vi.mock('@hallelujahhomechurch/hhc-web-client', async original => ({...await original<typeof import('@hallelujahhomechurch/hhc-web-client')>(), createHhcWebClient: () => client}));
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const auth = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};
beforeEach(() => {vi.clearAllMocks(); client.listOnlineBulletinDiscovery.mockResolvedValue({items: [{issueId: readerFixture().document.issueId, issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant', onlineRevision: 1}]}); client.openOnlineBulletin.mockResolvedValue(readerFixture());});

describe('member reader access', () => {
  it.each(['zh-Hant','zh-Hans'] as const)('accepts immutable V9 %s snapshots without current-setting lookups',contentLocale=>{
    const value=readerFixture(contentLocale,'v9');
    expect(verifyReaderAccess(value,{...selector,contentLocale}).templateSnapshot).toEqual(value.document.content.templateSnapshot);
  });
  it.each(['missing','null','unsafe','extra','control','empty'] as const)('rejects V9 %s snapshots before exposing private content',reason=>{
    const value=readerFixture('zh-Hant','v9');
    const snapshot=value.document.content.templateSnapshot!;
    if(reason==='missing')delete value.document.content.templateSnapshot;
    else if(reason==='null')Reflect.set(value.document.content,'templateSnapshot',null);
    else if(reason==='unsafe')snapshot.version=9007199254740992;
    else if(reason==='extra')Reflect.set(snapshot,'privateEvidence','not renderable');
    else if(reason==='control')snapshot.visionMission='Hidden\u202econtent';
    else snapshot.visionMission='';
    expect(()=>verifyReaderAccess(value,selector)).toThrow('invalid_template_snapshot');
  });
  it('rejects a snapshot attached to a legacy renderer',()=>{
    const value=readerFixture();
    value.document.content.templateSnapshot=readerFixture('zh-Hant','v9').document.content.templateSnapshot;
    expect(()=>verifyReaderAccess(value,selector)).toThrow('update_required');
  });
  it.each(['zh-Hant','zh-Hans'] as const)('accepts V3–V8 with the existing %s template while retaining receipt verification',contentLocale=>{
    for (const rendererVersion of ['v3','v4','v5','v6','v7','v8'] as const) {
    const value=readerFixture(contentLocale,rendererVersion);
    expect(verifyReaderAccess(value,{...selector,contentLocale}).contentLocale).toBe(contentLocale);
    value.access.accountId='another-account';
    expect(()=>verifyReaderAccess(value,{...selector,contentLocale})).toThrow('invalid_reader_binding');
    }
  });
  it.each(['digest','asset'] as const)('rejects an altered V6 %s before exposing private content',reason=>{
    const value=readerFixture('zh-Hant','v6');
    if(reason==='digest')value.document.content.layoutManifest.rendererArtifactSha256='0'.repeat(64);
    else value.document.content.layoutManifest.assets[0].sha256='0'.repeat(64);
    expect(()=>verifyReaderAccess(value,selector)).toThrow('update_required');
  });
  it.each((['zh-Hant', 'zh-Hans'] as const).flatMap(locale => (['v7', 'v8'] as const).map(version => [locale, version] as const)))('rejects altered %s %s assets and digest', (contentLocale, version) => {
    for (const field of ['digest', 'sha256', 'url', 'kind'] as const) {
      const value = readerFixture(contentLocale, version);
      const manifest = value.document.content.layoutManifest;
      if (field === 'digest') manifest.rendererArtifactSha256 = '0'.repeat(64);
      else if (field === 'sha256') manifest.assets[0].sha256 = '0'.repeat(64);
      else if (field === 'url') manifest.assets[0].url = 'https://outside.invalid/font.woff2';
      else manifest.assets[0].kind = 'decoration';
      expect(() => verifyReaderAccess(value, {...selector, contentLocale})).toThrow('update_required');
    }
  });
  it.each(['zh-Hant', 'zh-Hans'] as const)('does not extend old %s renderers with V7 font permissions', contentLocale => {
    const value = readerFixture(contentLocale, 'v6');
    const bold = readerFixture(contentLocale, 'v7').document.content.layoutManifest.assets.find(asset => asset.url.includes('body-bold-49bf74'));
    expect(bold).toBeDefined();
    value.document.content.layoutManifest.assets.push(bold!);
    expect(() => verifyReaderAccess(value, {...selector, contentLocale})).toThrow('update_required');
  });
  it('accepts pinned Simplified V2 only with its exact language and private document binding',()=>{
    const value=readerFixture();
    value.document.contentLocale=value.access.contentLocale='zh-Hans';
    value.document.documentId=value.access.documentId='simplified-document';
    value.document.content.templateVersion='v2';
    Object.assign(value.document.content.layoutManifest,{templateVersion:'v2',rendererVersion:'v2',rendererArtifactSha256:BULLETIN_RENDERER_V2_DIGEST,assets:BULLETIN_RENDERER_V2_ASSETS.map(asset=>({url:asset.url,sha256:asset.sha256,kind:asset.kind}))});
    expect(verifyReaderAccess(value,{...selector,contentLocale:'zh-Hans'}).contentLocale).toBe('zh-Hans');
    expect(()=>verifyReaderAccess(value,selector)).toThrow('invalid_reader_binding');
    value.access.documentId='traditional-document';
    expect(()=>verifyReaderAccess(value,{...selector,contentLocale:'zh-Hans'})).toThrow('invalid_reader_binding');
  });
  it('opens the latest revision by immutable issue identity only after an explicit update request', async () => {
    const saved = readerFixture();
    const newer = readerFixture(); newer.document.revision = newer.access.revision = newer.access.currentRevision = 2;
    client.openOnlineBulletin.mockResolvedValue(newer);
    const api = createReaderApi(auth);
    expect(await api.current(selector, saved, 'update-request')).toEqual(newer);
    expect(client.listOnlineBulletinDiscovery).not.toHaveBeenCalled();
    expect(client.openOnlineBulletin).toHaveBeenCalledWith({issueId: saved.document.issueId, series: 'general', locale: 'zh-Hant', clientRequestId: 'update-request', signal: undefined});
  });
  it('rejects private responses from a different account and verifies before returning a mutation acknowledgement', async () => {
    const value = readerFixture();
    const state = {accountId: 'other', documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []};
    client.getReaderState.mockResolvedValue({state});
    const api = createReaderApi(auth);
    await expect(api.privateState(selector, value)).rejects.toThrow('invalid_reader_binding');
    state.accountId = selector.accountId;
    await expect(api.privateState(selector, value)).resolves.toMatchObject({state});
    const mutations = [{mutationId: 'id', createdAt: '2026-10-02T00:00:00Z', documentRevision: 1, kind: 'clearHighlight' as const, payload: {sentenceIds: ['s0']}}];
    client.applyReaderMutations.mockResolvedValue({state, results: [{mutationId: 'wrong', status: 'applied', revision: 1}]});
    await expect(api.mutate(selector, value, mutations)).rejects.toThrow('invalid_reader_binding');
  });
  it('revalidates a pinned revision by immutable issue ID without rediscovering mutable printed metadata', async () => {
    const saved = readerFixture();
    saved.document.canonicalMetadata.issueNumber = 1738;
    await createReaderApi(auth).renew(selector, saved, 'renew-request');
    expect(client.listOnlineBulletinDiscovery).not.toHaveBeenCalled();
    expect(client.openOnlineBulletin).toHaveBeenCalledWith({issueId: saved.document.issueId, series: 'general', locale: 'zh-Hant', revision: 1, receiptId: 'receipt-a', clientRequestId: 'renew-request', signal: undefined});
  });
  it('rejects a renewal response bound to a different issue or pinned revision', async () => {
    const saved = readerFixture();
    const changed = readerFixture(); changed.document.issueId = 'different';
    client.openOnlineBulletin.mockResolvedValueOnce(changed);
    await expect(createReaderApi(auth).renew(selector, saved, 'id')).rejects.toThrow('invalid_reader_binding');
    changed.document.issueId = saved.document.issueId;
    changed.document.revision = changed.access.revision = changed.access.currentRevision = 2;
    client.openOnlineBulletin.mockResolvedValueOnce(changed);
    await expect(createReaderApi(auth).renew(selector, saved, 'id')).rejects.toThrow('invalid_reader_binding');
  });
  it('resolves the exact issue and reuses the receipt issuance request ID on retry', async () => {
    const api = createReaderApi(auth);
    const signal = new AbortController().signal;
    await api.open(selector, {clientRequestId: 'same-request'}, signal);
    await api.open(selector, {clientRequestId: 'same-request'}, signal);
    expect(client.listOnlineBulletinDiscovery).toHaveBeenCalledWith({series: 'general', locale: 'zh-Hant', offset: 0, limit: 1, issueNumber: 1739, signal});
    expect(client.openOnlineBulletin).toHaveBeenLastCalledWith({issueId: readerFixture().document.issueId, series: 'general', locale: 'zh-Hant', clientRequestId: 'same-request', signal});
  });
  it('does not issue access for a PDF-only or mismatched discovery edition', async () => {
    client.listOnlineBulletinDiscovery.mockResolvedValueOnce({items: [{...readerFixture().document, onlineRevision: null}]}).mockResolvedValueOnce({items: [{...readerFixture().document, issueNumber: 1739, contentLocale: 'en', onlineRevision: 1}]});
    const api = createReaderApi(auth);
    await expect(api.open(selector, {clientRequestId: 'id'})).rejects.toThrow('unavailable');
    await expect(api.open(selector, {clientRequestId: 'id'})).rejects.toThrow('unavailable');
    expect(client.openOnlineBulletin).not.toHaveBeenCalled();
  });
  it('keeps the shared renderer source-free while preserving the printed summary', () => {
    expect(verifyReaderAccess(readerFixture(), selector).sourcePageCount).toBe(12);
  });
  it('accepts a frozen printed issue number after canonical metadata changes', async () => {
    const value = readerFixture();
    value.document.canonicalMetadata.issueNumber = 1738;
    value.document.metadataSyncPending = true;
    client.openOnlineBulletin.mockResolvedValue(value);
    await expect(createReaderApi(auth).open(selector, {clientRequestId: 'id'})).resolves.toEqual(value);
  });
  it.each(['account', 'revision', 'renderer', 'proof', 'asset', 'expiry'])('rejects invalid %s binding before rendering', reason => {
    const value = readerFixture();
    if (reason === 'account') value.access.accountId = 'other';
    if (reason === 'revision') value.access.revision++;
    if (reason === 'renderer') value.document.content.layoutManifest.rendererArtifactSha256 = '0'.repeat(64);
    if (reason === 'proof') delete value.document.content.layoutManifest.layoutValidationHash;
    if (reason === 'asset') value.document.content.layoutManifest.assets[0].url = 'https://outside.invalid/font.woff2';
    if (reason === 'expiry') value.access.offlineValidUntil = value.access.validatedAt;
    expect(() => verifyReaderAccess(value, selector)).toThrow();
  });
});
