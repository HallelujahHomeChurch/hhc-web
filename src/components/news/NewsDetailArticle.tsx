/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {formatContentTimestamp} from '@/features/content/locale';
import type {NewsDetail} from '@/features/news/types';

type Props = {
  news: NewsDetail;
  backHref: string;
  backLabel: string;
  activityDateLabel: string;
  authorLabel: string;
  publishedAtLabel: string;
  updatedAtLabel: string;
  organizationName: string;
};

export function NewsDetailArticle({news, backHref, backLabel, activityDateLabel, authorLabel, publishedAtLabel, updatedAtLabel, organizationName}: Props) {
  const sideLayout = news.imageSrc && news.layout !== 'top';
  const publishedAt = news.firstPublishedAt ? formatContentTimestamp(news.firstPublishedAt, news.resolvedLocale) : '';
  const updatedAt = news.firstPublishedAt && news.lastPublishedAt && Date.parse(news.lastPublishedAt) > Date.parse(news.firstPublishedAt)
    ? formatContentTimestamp(news.lastPublishedAt, news.resolvedLocale)
    : '';
  const media = news.imageSrc ? <img src={news.imageSrc} alt={news.imageAlt} lang={news.resolvedLocale} className="mx-auto block h-auto max-h-[72vh] max-w-full rounded-xl bg-panel object-contain ring-1 ring-panel-border" /> : null;
  const copy = <div data-news-copy className={sideLayout ? 'min-w-0' : ''}>
    <header className="mb-8 border-b border-line pb-7">
      <h1 lang={news.resolvedLocale} className="text-[clamp(30px,5vw,48px)] font-semibold leading-tight text-ink">{news.title}</h1>
      {news.date ? <p className="mt-4 text-sm font-semibold text-muted"><span>{activityDateLabel}</span> · <time dateTime={news.displayDate} lang={news.resolvedLocale}>{news.date}</time></p> : null}
    </header>
    {news.body ? <div lang={news.resolvedLocale} className="whitespace-pre-line text-[17px] leading-[1.9] text-ink">{news.body}</div> : null}
    <footer className="mt-12 border-t border-line pt-5 text-sm leading-7 text-muted">
      <p><span>{authorLabel}</span> · <span lang={news.resolvedLocale}>{news.authorName || organizationName}</span></p>
      {publishedAt ? <p><span>{publishedAtLabel}</span> · <time dateTime={news.firstPublishedAt} lang={news.resolvedLocale}>{publishedAt}</time></p> : null}
      {updatedAt ? <p><span>{updatedAtLabel}</span> · <time dateTime={news.lastPublishedAt} lang={news.resolvedLocale}>{updatedAt}</time></p> : null}
    </footer>
  </div>;

  return <article className="shell max-w-[1120px]" data-layout={news.layout}>
    <Link href={backHref} className="mb-6 inline-flex min-h-11 items-center font-semibold text-primary">← {backLabel}</Link>
    {sideLayout ? <div className="grid grid-cols-[minmax(280px,.9fr)_minmax(0,1.1fr)] items-start gap-[clamp(28px,5vw,64px)] max-[760px]:grid-cols-1">
      <div className={news.layout === 'right' ? 'order-2 max-[760px]:order-1' : ''}>{media}</div>
      <div className={news.layout === 'right' ? 'order-1 max-[760px]:order-2' : ''}>{copy}</div>
    </div> : <>{media ? <div className="mb-8">{media}</div> : null}{copy}</>}
  </article>;
}
