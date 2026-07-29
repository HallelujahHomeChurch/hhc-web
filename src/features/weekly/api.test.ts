import {describe, expect, it} from 'vitest';
import {getLatestWeekly, getWeeklyIssuePage, getWeeklyIssues} from './api';

describe('weekly api', () => {
  it('returns the latest bulletin for the requested locale', () => {
    expect(getLatestWeekly('zh-Hant')).toMatchObject({
      locale: 'zh-Hant',
      date: '2025.05.11',
      title: '愛在家中成長',
      subtitle: '在愛中建造家庭，在真理中成長'
    });
  });

  it('returns all issues with three downloadable locale versions', () => {
    const [issue] = getWeeklyIssues();

    expect(issue.versions.map((version) => version.locale)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
    expect(issue.versions.every((version) => version.href.endsWith('.pdf'))).toBe(true);
  });

  it('returns paginated history issues without the latest issue', () => {
    const page = getWeeklyIssuePage({locale: 'zh-Hant', page: 1, pageSize: 1});

    expect(page).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('2025-05-04');
  });

  it('normalizes out-of-range pagination requests', () => {
    expect(getWeeklyIssuePage({locale: 'zh-Hant', page: -10, pageSize: 1}).page).toBe(1);
    expect(getWeeklyIssuePage({locale: 'zh-Hant', page: 99, pageSize: 1}).page).toBe(1);
  });
});
