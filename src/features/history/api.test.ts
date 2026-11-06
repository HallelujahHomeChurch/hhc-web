import {afterEach, describe, expect, it, vi} from 'vitest';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getHistoryTimeline, getHistoryTimelinePage} from './api';

describe('getHistoryTimeline', () => {
  it('maps published history projections', async () => {
    const client = clientWith([{id: 'event-1', title: '教會沿革', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant', 'en'], eventDate: '1984-03-01', dateLabel: 'legacy label', body: '領受建造家庭祭壇的異象。'}]);
    const payload = await getHistoryTimeline('ja', client);

    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]).toMatchObject({
      date: '1984年3月1日',
      body: expect.stringContaining('家庭祭壇'),
      requestedLocale: 'ja',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant', 'en']
    });
  });

  it('formats partial canonical dates for the active locale', async () => {
    const client = clientWith([
      {id: 'year', resolvedLocale: 'en', availableLocales: ['en'], eventDate: '1984', body: 'Year'},
      {id: 'month', resolvedLocale: 'en', availableLocales: ['en'], eventDate: '1984-03', body: 'Month'},
    ]);

    await expect(getHistoryTimeline('en', client)).resolves.toEqual({events: [
      {date: '1984', body: 'Year', requestedLocale: 'en', resolvedLocale: 'en', availableLocales: ['en']},
      {date: 'March 1984', body: 'Month', requestedLocale: 'en', resolvedLocale: 'en', availableLocales: ['en']},
    ]});
  });

  it('falls back to the legacy date label while imported data is backfilled', async () => {
    const client = clientWith([
      {id: 'legacy', eventDate: undefined, dateLabel: '2005年9月18日', body: 'Legacy'},
    ]);

    await expect(getHistoryTimeline('zh-Hant', client)).resolves.toEqual({events: [
      {date: '2005年9月18日', body: 'Legacy', requestedLocale: 'zh-Hant', resolvedLocale: 'zh-Hant', availableLocales: []},
    ]});
  });

  it('keeps public pagination metadata', async () => {
    const client = {listPublicContentPage: async () => ({
      data: [{id: 'event-1', eventDate: '1984', body: 'Year'}],
      meta: {page: 2, pageSize: 12, total: 20}
    })} as unknown as HhcWebClient;

    await expect(getHistoryTimelinePage('en', 2, 12, client)).resolves.toEqual({
      events: [{date: '1984', body: 'Year', requestedLocale: 'en', resolvedLocale: 'en', availableLocales: []}],
      meta: {page: 2, pageSize: 12, total: 20}
    });
  });

  it('collects every published history page for the public timeline', async () => {
    const listPublicContentPage = async (_module: string, _locale: string, input: {page: number; pageSize: number}) => ({
      data: input.page === 1
        ? [{id: 'event-1', eventDate: '1984', body: 'First'}]
        : [{id: 'event-2', eventDate: '1985', body: 'Second'}],
      meta: {page: input.page, pageSize: 1, total: 2}
    });
    const client = {listPublicContentPage} as unknown as HhcWebClient;

    await expect(getHistoryTimeline('en', client)).resolves.toEqual({events: [
      {date: '1984', body: 'First', requestedLocale: 'en', resolvedLocale: 'en', availableLocales: []},
      {date: '1985', body: 'Second', requestedLocale: 'en', resolvedLocale: 'en', availableLocales: []},
    ]});
  });
});

function clientWith(values: Array<Record<string, unknown>>) {
  return {listPublicContentPage: async () => ({data: values, meta: {page: 1, pageSize: 100, total: values.length}})} as unknown as HhcWebClient;
}

describe('About history transport', () => {
  const privateBase = 'https://hhc-web-api.internal.example.eastasia.azurecontainerapps.io/api';
  const daprBase = 'http://127.0.0.1:3500/v1.0/invoke/hhc-web-api/method/api';

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('only sends the full timeline over private HTTPS when configured', async () => {
    vi.stubEnv('HHC_WEB_API_BASE_URL', daprBase);
    vi.stubEnv('HHC_WEB_HISTORY_API_BASE_URL', privateBase);
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => Response.json({data: [{id: 'one'}], meta: {total: 2}}))
      .mockImplementationOnce(async () => Response.json({data: [{id: 'two'}], meta: {total: 2}}))
      .mockImplementationOnce(async () => Response.json({data: [], meta: {total: 0}}));
    vi.stubGlobal('fetch', fetch);

    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await expect(getHistoryTimeline('ja')).resolves.toMatchObject({events: [{requestedLocale: 'ja'}, {requestedLocale: 'ja'}]});
    expect(timeout.mock.calls).toEqual([[10_000]]);
    await getHistoryTimelinePage('en', 3, 12);

    expect(fetch.mock.calls.map(([request]) => (request as Request).url)).toEqual([
      privateBase + '/history?locale=ja&page=1&pageSize=100',
      privateBase + '/history?locale=ja&page=2&pageSize=100',
      daprBase + '/history?locale=en&page=3&pageSize=12'
    ]);
    for (const [request, init] of fetch.mock.calls) {
      expect((request as Request).headers.get('authorization')).toBeNull();
      expect(init).toMatchObject({redirect: 'error', next: {revalidate: 60}});
    }
  });

  it('defaults to Dapr without an explicit private base', async () => {
    vi.stubEnv('HHC_WEB_API_BASE_URL', daprBase);
    vi.stubEnv('HHC_WEB_HISTORY_API_BASE_URL', undefined);
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({data: [], meta: {total: 0}}));
    vi.stubGlobal('fetch', fetch);

    await getHistoryTimeline('en');

    expect((fetch.mock.calls[0][0] as Request).url).toBe(daprBase + '/history?locale=en&page=1&pageSize=100');
  });

  it('rejects a configured origin outside internal ACA', async () => {
    vi.stubEnv('HHC_WEB_HISTORY_API_BASE_URL', 'https://www.alive.org.tw/api');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(getHistoryTimeline('en')).rejects.toThrow('HHC_WEB_HISTORY_API_BASE_URL');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces private transport failure without retrying Dapr', async () => {
    vi.stubEnv('HHC_WEB_HISTORY_API_BASE_URL', privateBase);
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('private transport failed'));
    vi.stubGlobal('fetch', fetch);

    await expect(getHistoryTimeline('en')).rejects.toThrow('private transport failed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
