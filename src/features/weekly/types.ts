import type {BulletinEdition} from '@hallelujahhomechurch/preferences';

export const weeklyEditionLabels: Record<BulletinEdition, string> = {
  'zh-Hant': '繁中',
  'zh-Hans': '简中',
  en: 'English'
};

export type WeeklyBulletin = {
  locale: BulletinEdition;
  issueNumber?: number;
  date: string;
  title: string;
  subtitle?: string;
  href: string;
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
