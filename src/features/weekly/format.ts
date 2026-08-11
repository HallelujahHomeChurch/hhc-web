import type {Locale} from '@/i18n/locales';

export function formatIssueNumber(locale: Locale, issueNumber?: number) {
  if (!issueNumber) return null;
  if (locale === 'en') return `Issue ${issueNumber}`;
  if (locale === 'ja') return `第${issueNumber}号`;
  if (locale === 'ko') return `제${issueNumber}호`;
  return `第 ${issueNumber} 期`;
}
