import {describe, expect, it} from 'vitest';
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
