import type {Locale} from '@/i18n/locales';

export type WeeklyBulletin = {
  locale: Locale;
  date: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type WeeklyIssue = {
  id: string;
  date: string;
  versions: WeeklyBulletin[];
};

export type WeeklyIssuePageParams = {
  locale: Locale;
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
