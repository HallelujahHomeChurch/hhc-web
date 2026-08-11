import {weeklyIssues} from './mock-data';
import type {WeeklyIssuePageParams} from './types';

export function getLatestWeekly() {
  return weeklyIssues[0];
}

export function getWeekly() {
  return getLatestWeekly();
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
