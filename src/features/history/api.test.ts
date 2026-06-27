import {describe, expect, it} from 'vitest';
import {getHistoryTimeline} from './api';

describe('getHistoryTimeline', () => {
  it('returns the history event payload for the requested locale', () => {
    const payload = getHistoryTimeline('zh-Hant');

    expect(payload.events.length).toBeGreaterThan(20);
    expect(payload.events[0]).toMatchObject({
      date: '1984年',
      body: expect.stringContaining('家庭祭壇')
    });
  });
});
