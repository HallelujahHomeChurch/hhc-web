import {describe, expect, it} from 'vitest';
import {historyByLocale} from '@/features/history/mock-data';
import {newsByLocale} from '@/features/news/mock-data';
import {weeklyIssues} from '@/features/weekly/mock-data';
import {getMockPayload} from './handlers';

describe('mock handlers', () => {
  it('serves payloads from the same fixtures used by local APIs', () => {
    expect(getMockPayload('news', 'zh-Hant')).toBe(newsByLocale['zh-Hant']);
    expect(getMockPayload('history', 'zh-Hant')).toBe(historyByLocale['zh-Hant']);
    expect(getMockPayload('weekly', 'zh-Hant')).toBe(weeklyIssues[0].versions[0]);
  });
});
