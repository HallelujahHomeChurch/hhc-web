import type {ContentLocaleMetadata} from '@/features/content/locale';

type StatementText = {type: 'text'; text: string; marks?: ('strong' | 'emphasis')[]; color?: string; highlight?: string};
export type StatementInline =
  | StatementText
  | {type: 'lineBreak'}
  | {type: 'link'; href: string; title?: string; content: StatementText[]};

type StatementTextBlock = {
  id: string;
  type: 'paragraph' | 'heading' | 'quote';
  level?: 2 | 3;
  alignment?: 'start' | 'center' | 'end';
  content?: StatementInline[];
  source?: StatementInline[];
};

export type StatementDocument = {
  schemaVersion: 1;
  blocks: (StatementTextBlock | {
    id: string;
    type: 'list';
    ordered: boolean;
    items: {content: StatementInline[]}[];
  } | {
    id: string;
    type: 'image';
    url: string;
    size?: 'small' | 'medium' | 'full';
    alignment?: 'start' | 'center' | 'end';
    alt: {mode: 'text'; text: string} | {mode: 'decorative'};
    caption?: StatementInline[];
  })[];
};

export type NewsItem = ContentLocaleMetadata & {
  kind?: 'general' | 'statement';
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
  bodyJson?: StatementDocument;
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
