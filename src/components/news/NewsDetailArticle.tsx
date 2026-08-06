/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type {NewsDetail} from '@/features/news/types';

type Props = {
  news: NewsDetail;
  backHref: string;
  backLabel: string;
  publishedAtLabel: string;
};

export function NewsDetailArticle({news, backHref, backLabel, publishedAtLabel}: Props) {
  const sideLayout = news.imageSrc && news.layout !== 'top';
  const media = news.imageSrc ? <img src={news.imageSrc} alt={news.imageAlt} className="mx-auto block h-auto max-h-[72vh] max-w-full rounded-xl bg-panel object-contain ring-1 ring-panel-border" /> : null;
  const copy = <div data-news-copy className={sideLayout ? 'min-w-0' : ''}>
    <header className="mb-8 border-b border-line pb-7">
      <h1 className="text-[clamp(30px,5vw,48px)] font-semibold leading-tight text-ink">{news.title}</h1>
      {news.date ? <p className="mt-4 text-sm font-semibold text-muted">{publishedAtLabel} · {news.date}</p> : null}
    </header>
    {news.body ? <div className="whitespace-pre-line text-[17px] leading-[1.9] text-ink">{news.body}</div> : null}
  </div>;

  return <article className="shell max-w-[1120px]" data-layout={news.layout}>
    <Link href={backHref} className="mb-6 inline-flex min-h-11 items-center font-semibold text-primary">← {backLabel}</Link>
    {sideLayout ? <div className="grid grid-cols-[minmax(280px,.9fr)_minmax(0,1.1fr)] items-start gap-[clamp(28px,5vw,64px)] max-[760px]:grid-cols-1">
      <div className={news.layout === 'right' ? 'order-2 max-[760px]:order-1' : ''}>{media}</div>
      <div className={news.layout === 'right' ? 'order-1 max-[760px]:order-2' : ''}>{copy}</div>
    </div> : <>{media ? <div className="mb-8">{media}</div> : null}{copy}</>}
  </article>;
}
