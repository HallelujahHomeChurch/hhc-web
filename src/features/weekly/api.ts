import type {Locale} from '@/i18n/locales';
import {weeklyByLocale, weeklyIssues} from './mock-data';
import type {WeeklyIssuePageParams} from './types';

export function getLatestWeekly(locale: Locale) {
  return weeklyByLocale[locale];
}

export function getWeekly(locale: Locale) {
  return getLatestWeekly(locale);
}

export function getWeeklyIssues() {
  return weeklyIssues;
}

export function getWeeklyIssuePage({page = 1, pageSize = 12}: WeeklyIssuePageParams) {
  const historyIssues = weeklyIssues.slice(1);
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = historyIssues.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const normalizedPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: historyIssues.slice(start, start + normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages
  };
}
