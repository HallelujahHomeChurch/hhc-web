export type NewsItem = {
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
  layout: 'top' | 'left' | 'right';
};

export type NewsPage = {
  items: NewsItem[];
  meta: {page: number; pageSize: number; total: number};
};
