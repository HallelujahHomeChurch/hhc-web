import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {describe, expect, it, vi} from 'vitest';
import {createWeeklyBulletinApi} from './api';

const bulletin = {
  issueId: '00000000-0000-4000-8000-000000000001', issueDate: '2026-09-13', issueNumber: 1737,
  series: 'general' as const, locale: 'zh-Hant' as const, date: '2026-09-13', title: '週報', subtitle: '', downloadName: '1737.pdf', publishedAt: '2026-09-13T00:00:00Z', version: 1
};
const discovery = {issueId:bulletin.issueId,issueDate:bulletin.issueDate,issueNumber:bulletin.issueNumber,series:bulletin.series,contentLocale:bulletin.locale,canonicalMetadata:{title:bulletin.title,subtitle:bulletin.subtitle,date:bulletin.date,issueNumber:bulletin.issueNumber},pdfPublished:true,onlineRevision:2,documentId:'document-1'};
const pageEnvelope = {data:{items:[discovery],total:1,offset:0,limit:1},meta:{},error:null};

describe('member weekly API', () => {
  it('uses protected routes and retries once after a 401', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, {status: 401}))
      .mockResolvedValueOnce(Response.json(pageEnvelope));
    const refresh = vi.fn().mockResolvedValue('new-token');
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('old-token'), refreshAfterUnauthorized: refresh}, fetcher);

    await expect(api.fetchLatest('general', ['zh-Hant'])).resolves.toMatchObject({id: bulletin.issueId});
    expect(refresh).toHaveBeenCalledWith('old-token');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const request = fetcher.mock.calls[1]?.[0] as Request;
    expect(request.url).toContain('/api/member/bulletins/online?series=general&offset=0&limit=1&locales=zh-Hant');
    expect(request.headers.get('authorization')).toBe('Bearer new-token');
  });

  it('does not refresh a 403 and never falls back to a public route', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, {status: 403}));
    const refresh = vi.fn().mockResolvedValue('new-token');
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: refresh}, fetcher);

    await expect(api.fetchLatest('general', ['zh-Hant'])).rejects.toMatchObject({status: 403});
    expect(refresh).not.toHaveBeenCalled();
    expect((fetcher.mock.calls[0]?.[0] as Request).url).toContain('/api/member/bulletins/online');
  });

  it('never treats an authorization denial as language absence or retries through the PDF API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, {status:404}));
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}, fetcher);

    await expect(api.fetchLatest('general', ['zh-Hant', 'en'])).rejects.toMatchObject({status:404});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps a protected archive 404 unavailable rather than silently empty', async () => {
    const api = createWeeklyBulletinApi({getAccessToken: vi.fn().mockResolvedValue('token'), refreshAfterUnauthorized: vi.fn()}, vi.fn().mockResolvedValue(Response.json({}, {status: 404})));

    await expect(api.fetchArchive('general', ['zh-Hant'])).rejects.toMatchObject({status:404});
  });

  it('uses authoritative union pagination and keeps Online-only separate from Download',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:{items:[{...discovery,pdfPublished:false}],total:25,offset:12,limit:12},meta:{},error:null}));
    const api=createWeeklyBulletinApi({getAccessToken:vi.fn().mockResolvedValue('token'),refreshAfterUnauthorized:vi.fn()},fetcher);
    const result=await api.fetchArchive('general',['zh-Hant','en'],{page:2,pageSize:12});
    expect(result).toMatchObject({page:2,totalItems:25,totalPages:3,items:[{versions:[{pdfPublished:false,onlineRevision:2}]}]});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const query=new URL((fetcher.mock.calls[0]![0] as Request).url).searchParams;
    expect(query.get('locales')).toBe('zh-Hant,en');
    expect(query.get('offset')).toBe('12');
  });

  it('only falls back to the existing protected PDF latest on a transient failure',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, {status:503})).mockResolvedValueOnce(Response.json({data:bulletin,meta:{},error:null}));
    const api=createWeeklyBulletinApi({getAccessToken:vi.fn().mockResolvedValue('token'),refreshAfterUnauthorized:vi.fn()},fetcher);
    expect(await api.fetchLatest('general',['zh-Hant'])).toMatchObject({versions:[{pdfPublished:true}]});
    expect((fetcher.mock.calls[1]![0] as Request).url).toContain('/api/member/bulletins/latest');
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

it('signals a typed legal review requirement before protected content can be used',async()=> {
 const event=vi.fn();window.addEventListener('hhc:legal-required',event);
 const api=createWeeklyBulletinApi({getAccessToken:async()=> 'token',refreshAfterUnauthorized:async()=>null},async()=>Response.json({error:{code:'policy_acceptance_required'}},{status:428}));
 try {await expect(api.fetchLatest('general',['en'])).rejects.toBeInstanceOf(HhcWebApiError);expect(event).toHaveBeenCalledOnce()}
 finally {window.removeEventListener('hhc:legal-required',event)}
});
