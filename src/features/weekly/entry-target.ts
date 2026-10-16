import {bulletinEditions, type BulletinEdition} from '@hallelujahhomechurch/preferences';

export type WeeklyEntryTarget = BulletinEdition & {issueNumber?: number};

export function validIssueNumber(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2_147_483_647;
}

/** A partial or invalid target never falls back to a different issue or edition. */
export function weeklyEntryTarget(params: Pick<URLSearchParams, 'get' | 'getAll' | 'has'>): WeeklyEntryTarget | null | undefined {
  if (!params.has('issueNumber') && !params.has('contentLocale')) return undefined;
  if (['series', 'contentLocale'].some(key => params.getAll(key).length !== 1) || params.getAll('issueNumber').length > 1) return null;
  const issue = params.get('issueNumber');
  const edition = bulletinEditions.find(value => value.series === params.get('series') && value.locale === params.get('contentLocale'));
  return edition && (issue === null || validIssueNumber(issue)) ? {...edition, ...(issue === null ? {} : {issueNumber: Number(issue)})} : null;
}

export function targetQuery(target: WeeklyEntryTarget): URLSearchParams {
  return new URLSearchParams({series: target.series, ...(target.issueNumber ? {issueNumber: String(target.issueNumber)} : {}), contentLocale: target.locale});
}
