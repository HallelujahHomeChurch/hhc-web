import type {ContentLocaleMetadata} from '@/features/content/locale';

export type NewsItem = ContentLocaleMetadata & {
  id: string;
  title: string;
  summary: string;
  date: string;
  imageAlt: string;
  imageSrc?: string;
  href: string;
};

export type NewsDetail = NewsItem & {
  body: string;
  displayDate: string;
  authorName: string;
  firstPublishedAt?: string;
  lastPublishedAt?: string;
  layout: 'top' | 'left' | 'right';
};

export type NewsPage = {
  items: NewsItem[];
  meta: {page: number; pageSize: number; total: number};
};
