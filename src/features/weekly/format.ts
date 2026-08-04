import type {Locale} from '@/i18n/locales';

export function formatIssueNumber(locale: Locale, issueNumber?: number) {
  if (!issueNumber) return null;
  return locale === 'en' ? `Issue ${issueNumber}` : `第 ${issueNumber} 期`;
}
