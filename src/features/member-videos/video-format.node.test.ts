import {expect, it} from 'vitest';
import {formatVideoViews, relativeVideoTime} from './video-format';

it('uses locale-specific compact views and retains exact totals on expansion', () => {
  expect(formatVideoViews(0, 'zh-Hant')).toBe('0');
  expect(formatVideoViews(9999, 'zh-Hant')).toBe('9,999');
  expect(formatVideoViews(10000, 'zh-Hant')).toBe('1萬');
  expect(formatVideoViews(18000, 'zh-Hant')).toBe('1.8萬');
  expect(formatVideoViews(18000, 'zh-Hant', true)).toBe('18,000');
  expect(formatVideoViews(100000000, 'zh-Hant')).toBe('1億');
  expect(formatVideoViews(18000, 'en')).toBe('18K');
  for (const locale of ['zh-Hans', 'ja', 'ko']) expect(formatVideoViews(18000, locale)).not.toContain('NaN');
});

it('formats video and comment ages through years without future or invalid ages', () => {
  const now = Date.parse('2026-10-24T00:00:00Z');
  const age = (seconds: number) => relativeVideoTime(new Date(now - seconds * 1000).toISOString(), 'en', now);
  expect(age(59)).toBe('59 seconds ago');
  expect(age(60)).toBe('1 minute ago');
  expect(age(3600)).toBe('1 hour ago');
  expect(age(86400)).toBe('1 day ago');
  expect(age(7 * 86400)).toBe('1 week ago');
  expect(age(30 * 86400)).toBe('1 month ago');
  expect(age(365 * 86400)).toBe('1 year ago');
  expect(age(-30)).toBe('0 seconds ago');
  expect(relativeVideoTime('invalid', 'en', now)).toBe('—');
  expect(relativeVideoTime('2026-10-22T00:00:00Z', 'zh-Hant', now)).toBe('2 天前');
});
