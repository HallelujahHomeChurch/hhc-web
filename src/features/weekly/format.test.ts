import {describe, expect, it} from 'vitest';
import {resolveWeeklyCopy} from './format';
import type {WeeklyIssue} from './types';

const issue: WeeklyIssue = {
  id: 'issue-1',
  date: '2026-08-10',
  versions: [
    {issueId: 'issue-1', series: 'general', locale: 'zh-Hant', date: '2026-08-10', title: '繁中標題', subtitle: '繁中副標', downloadName: 'zh-Hant.pdf'},
    {issueId: 'issue-1', series: 'general', locale: 'zh-Hans', date: '2026-08-10', title: '', subtitle: '', downloadName: 'zh-Hans.pdf'},
    {issueId: 'issue-1', series: 'general', locale: 'en', date: '2026-08-10', title: 'English title', subtitle: '', downloadName: 'en.pdf'}
  ]
};

describe('resolveWeeklyCopy', () => {
  it('uses exact edition copy, then Traditional Chinese fallback', () => {
    expect(resolveWeeklyCopy(issue, 'en')?.locale).toBe('en');
    expect(resolveWeeklyCopy(issue, 'zh-Hans')?.locale).toBe('zh-Hant');
    expect(resolveWeeklyCopy(issue, 'ja')?.locale).toBe('zh-Hant');
    expect(resolveWeeklyCopy(issue, 'ko')?.locale).toBe('zh-Hant');
  });
});
