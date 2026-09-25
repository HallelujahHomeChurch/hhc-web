import type {BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';

export const weeklyEditionLabels: Record<BulletinLocale, string> = {
  'zh-Hant': '繁中',
  'zh-Hans': '简中',
  en: 'English'
};

export type WeeklyBulletin = {
  issueId: string;
  series: BulletinSeries;
  locale: BulletinLocale;
  issueNumber?: number;
  date: string;
  title: string;
  subtitle?: string;
  downloadName: string;
};

export type WeeklyIssue = {
  id: string;
  issueNumber?: number;
  date: string;
  versions: WeeklyBulletin[];
};

export type WeeklyIssuePageParams = {
  page?: number;
  pageSize?: number;
};

export type WeeklyIssuePage = {
  items: WeeklyIssue[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
