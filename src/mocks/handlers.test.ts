import {describe, expect, it} from 'vitest';
import {historyByLocale} from '@/features/history/mock-data';
import {newsByLocale} from '@/features/news/mock-data';
import {getMockPayload} from './handlers';

describe('mock handlers', () => {
  it('serves payloads from the same fixtures used by local APIs', () => {
    expect(getMockPayload('news', 'zh-Hant')).toBe(newsByLocale['zh-Hant']);
    expect(getMockPayload('history', 'zh-Hant')).toBe(historyByLocale['zh-Hant']);
  });

  it('mirrors the existing Traditional Chinese fallback for new product locales', () => {
    expect(getMockPayload('news', 'ja')).toBe(newsByLocale['zh-Hant']);
    expect(getMockPayload('history', 'ko')).toBe(historyByLocale['zh-Hant']);
  });

});
