import {beforeEach, describe, expect, it, vi} from 'vitest';
import {readerFixture} from './test-fixture';
import {createReaderApi, verifyReaderAccess} from './api';

const client = vi.hoisted(() => ({listOnlineBulletinDiscovery: vi.fn(), openOnlineBulletin: vi.fn()}));
vi.mock('@hallelujahhomechurch/hhc-web-client', async original => ({...await original<typeof import('@hallelujahhomechurch/hhc-web-client')>(), createHhcWebClient: () => client}));
const selector = {accountId: 'account-a', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const auth = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};
beforeEach(() => {vi.clearAllMocks(); client.listOnlineBulletinDiscovery.mockResolvedValue({items: [{issueId: readerFixture().document.issueId, issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant', onlineRevision: 1}]}); client.openOnlineBulletin.mockResolvedValue(readerFixture());});

describe('member reader access', () => {
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
