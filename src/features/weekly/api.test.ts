import type {BulletinEdition} from '@hallelujahhomechurch/preferences';
import {describe, expect, expectTypeOf, it} from 'vitest';
import {getLatestWeekly, getWeeklyIssuePage, getWeeklyIssues} from './api';
import type {WeeklyBulletin} from './types';

describe('weekly api', () => {
  it('returns the latest issue without selecting from a product locale', () => {
    expect(getLatestWeekly()).toMatchObject({
      id: '2025-05-11',
      versions: [
        {locale: 'zh-Hant'},
        {locale: 'zh-Hans'},
        {locale: 'en'}
      ]
    });
  });

  it('returns all issues with three downloadable locale versions', () => {
    const [issue] = getWeeklyIssues();

    expectTypeOf<WeeklyBulletin['locale']>().toEqualTypeOf<BulletinEdition>();
    expectTypeOf<'ja'>().not.toExtend<WeeklyBulletin['locale']>();
    expectTypeOf<'ko'>().not.toExtend<WeeklyBulletin['locale']>();
    expect(issue.versions.map((version) => version.locale)).toEqual(['zh-Hant', 'zh-Hans', 'en']);
    expect(issue.versions.every((version) => version.href.endsWith('.pdf'))).toBe(true);
  });

  it('returns paginated history issues without the latest issue', () => {
    const page = getWeeklyIssuePage({page: 1, pageSize: 1});

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
    expect(getWeeklyIssuePage({page: -10, pageSize: 1}).page).toBe(1);
    expect(getWeeklyIssuePage({page: 99, pageSize: 1}).page).toBe(1);
  });
});
