import {describe, expect, it} from 'vitest';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getHistoryTimeline} from './api';

describe('getHistoryTimeline', () => {
  it('maps published history projections', async () => {
    const client = {listPublicContent: async () => [{id: 'event-1', title: '教會沿革', eventDate: '1984-03-01', dateLabel: 'legacy label', body: '領受建造家庭祭壇的異象。'}]} as unknown as HhcWebClient;
    const payload = await getHistoryTimeline('zh-Hant', client);

    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]).toMatchObject({
      date: '1984年3月1日',
      body: expect.stringContaining('家庭祭壇')
    });
  });

  it('formats partial canonical dates for the active locale', async () => {
    const client = {listPublicContent: async () => [
      {id: 'year', eventDate: '1984', body: 'Year'},
      {id: 'month', eventDate: '1984-03', body: 'Month'},
    ]} as unknown as HhcWebClient;

    await expect(getHistoryTimeline('en', client)).resolves.toEqual({events: [
      {date: '1984', body: 'Year'},
      {date: 'March 1984', body: 'Month'},
    ]});
  });

  it('falls back to the legacy date label while imported data is backfilled', async () => {
    const client = {listPublicContent: async () => [
      {id: 'legacy', eventDate: undefined, dateLabel: '2005年9月18日', body: 'Legacy'},
    ]} as unknown as HhcWebClient;

    await expect(getHistoryTimeline('zh-Hant', client)).resolves.toEqual({events: [
      {date: '2005年9月18日', body: 'Legacy'},
    ]});
  });
});
