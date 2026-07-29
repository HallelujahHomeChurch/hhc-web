import {describe, expect, it} from 'vitest';
import type {HhcWebClient} from '@hallelujahhomechurch/hhc-web-client';
import {getHistoryTimeline} from './api';

describe('getHistoryTimeline', () => {
  it('maps published history projections', async () => {
    const client = {listPublicContent: async () => [{id: 'event-1', title: '教會沿革', dateLabel: '1984年', body: '領受建造家庭祭壇的異象。'}]} as unknown as HhcWebClient;
    const payload = await getHistoryTimeline('zh-Hant', client);

    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]).toMatchObject({
      date: '1984年',
      body: expect.stringContaining('家庭祭壇')
    });
  });
});
