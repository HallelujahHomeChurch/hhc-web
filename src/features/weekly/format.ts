import type {Locale} from '@/i18n/locales';
import type {WeeklyIssue} from './types';

export function formatIssueNumber(locale: Locale, issueNumber?: number) {
  if (!issueNumber) return null;
  if (locale === 'en') return `Issue ${issueNumber}`;
  if (locale === 'ja') return `第${issueNumber}号`;
  if (locale === 'ko') return `제${issueNumber}호`;
  return `第 ${issueNumber} 期`;
}

export function resolveWeeklyCopy(issue: WeeklyIssue, locale: Locale) {
  const hasTitle = (version: WeeklyIssue['versions'][number]) => Boolean(version.title.trim());
  return issue.versions.find((version) => version.locale === locale && hasTitle(version))
    ?? issue.versions.find((version) => version.locale === 'zh-Hant' && hasTitle(version))
    ?? issue.versions.find(hasTitle)
    ?? null;
}
