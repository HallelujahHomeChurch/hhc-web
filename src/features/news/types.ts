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
};

export type NewsPage = {
  items: NewsItem[];
  meta: {page: number; pageSize: number; total: number};
};
