import {describe, expect, it, vi} from 'vitest';
import {createWeeklyBulletinApi} from './api';

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general' as const, locale: 'zh-Hant' as const, date: '2026-09-13', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};

describe('member weekly API', () => {
  it('uses protected routes and retries once after a 401', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, {status: 401}))
      .mockResolvedValueOnce(Response.json({data: bulletin, meta: {}, error: null}));
    const refresh = vi.fn().mockResolvedValue('new-token');
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('old-token'), refreshAfterUnauthorized: refresh}, fetcher);

    await expect(api.fetchLatest('general', ['zh-Hant'])).resolves.toMatchObject({id: bulletin.issueId});
    expect(refresh).toHaveBeenCalledWith('old-token');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const request = fetcher.mock.calls[1]?.[0] as Request;
    expect(request.url).toContain('/api/member/bulletins/latest?locale=zh-Hant&series=general');
    expect(request.headers.get('authorization')).toBe('Bearer new-token');
  });

  it('does not refresh a 403 and never falls back to a public route', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, {status: 403}));
    const refresh = vi.fn().mockResolvedValue('new-token');
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: refresh}, fetcher);

    await expect(api.fetchLatest('general', ['zh-Hant'])).rejects.toMatchObject({status: 403});
    expect(refresh).not.toHaveBeenCalled();
    expect((fetcher.mock.calls[0]?.[0] as Request).url).toContain('/api/member/bulletins/latest');
  });

  it('omits a revoked edition without exposing its metadata', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({data: bulletin, meta: {}, error: null}))
      .mockResolvedValueOnce(Response.json({}, {status: 404}));
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}, fetcher);

    await expect(api.fetchLatest('general', ['zh-Hant', 'en'])).resolves.toMatchObject({versions: [expect.objectContaining({locale: 'zh-Hant'})]});
  });

  it('treats a protected archive 404 as an empty result', async () => {
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}, vi.fn().mockResolvedValue(Response.json({}, {status: 404})));

    await expect(api.fetchArchive('general', ['zh-Hant'])).resolves.toMatchObject({items: [], totalItems: 0});
  });

  it('creates, reads, and downloads a prepared bulletin through only the protected job routes', async () => {
    const job = {id: '00000000-0000-4000-8000-000000000002', operationProgress: {status: 'queued', stage: 'queued', percent: 5, updatedAt: '2026-09-21T00:00:00Z', retryAfterMs: 2_500}, createdAt: '2026-09-21T00:00:00Z', expiresAt: '2026-09-21T01:00:00Z'};
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({data: job, meta: {}, error: null}, {status: 202}))
      .mockResolvedValueOnce(Response.json({data: job, meta: {}, error: null}, {status: 202}))
      .mockResolvedValueOnce(new Response('pdf', {headers: {'content-type': 'application/pdf'}}));
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}, fetcher);
    const signal = new AbortController().signal;

    await expect(api.createDownloadJob(bulletin, '00000000-0000-4000-8000-000000000003', signal)).resolves.toMatchObject({id: job.id});
    await expect(api.getDownloadJob(bulletin, job.id, signal)).resolves.toMatchObject({id: job.id});
    await expect(api.downloadPreparedBulletin(bulletin, job.id, signal)).resolves.toBeInstanceOf(Response);

    const [create, status, file] = fetcher.mock.calls.map(([input]) => input as Request);
    expect(create.url).toContain('/api/member/bulletin-download-jobs?series=general&locale=zh-Hant');
    expect(create.method).toBe('POST');
    expect(create.headers.get('idempotency-key')).toBe('00000000-0000-4000-8000-000000000003');
    await expect(create.json()).resolves.toEqual({issueId: bulletin.issueId});
    expect(status.url).toContain(`/api/member/bulletin-download-jobs/${job.id}?series=general&locale=zh-Hant`);
    expect(status.method).toBe('GET');
    expect(file.url).toContain(`/api/member/bulletin-download-jobs/${job.id}/file?locale=zh-Hant&series=general`);
    expect(file.headers.get('authorization')).toBe('Bearer token');
  });
});
