import type {NewsItem} from '@/features/news/types';
import {Newspaper} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

type NewsSectionProps = {
  title: string;
  moreHref?: string;
  moreLabel?: string;
  items: NewsItem[];
  errorMessage?: string;
};

export function NewsSection({title, moreHref, moreLabel, items, errorMessage}: NewsSectionProps) {
  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-center justify-between gap-5">
        <h2 className="m-0 text-2xl font-semibold tracking-[0.03em] text-ink">{title}</h2>
        {moreHref && moreLabel ? (
          <Link className="inline-flex min-h-11 items-center text-sm font-extrabold text-rose" href={moreHref}>
            {moreLabel}
          </Link>
        ) : null}
      </div>
      {errorMessage ? <p role="status" className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">{errorMessage}</p> : <ul className="m-0 grid list-none gap-3 p-0">
        {items.slice(0, 3).map((item) => (
          <li key={item.id}>
            <Link className="group grid min-h-[82px] grid-cols-[132px_minmax(0,1fr)] items-center gap-4 max-[620px]:grid-cols-[112px_minmax(0,1fr)]" href={item.href}>
              <span className="relative grid aspect-video w-[132px] place-items-center overflow-hidden rounded-[10px] bg-[var(--hhc-news-panel)] text-primary ring-1 ring-panel-border transition group-hover:ring-primary max-[620px]:w-28">
                {item.imageSrc ? (
                  <Image
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    fill
                    sizes="(max-width: 620px) 112px, 132px"
                    quality={70}
                    className="object-cover"
                  />
                ) : <Newspaper size={34} strokeWidth={1.5} aria-hidden="true" />}
              </span>
              <span>
                <h3 className="mb-1 line-clamp-2 text-base font-semibold leading-[1.45]">{item.title}</h3>
                <time className="text-[13px] font-bold text-muted">{item.date}</time>
              </span>
            </Link>
          </li>
        ))}
      </ul>}
    </div>
  );
}
