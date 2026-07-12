import type {NewsItem} from '@/features/news/types';

type NewsSectionProps = {
  title: string;
  moreLabel: string;
  items: NewsItem[];
};

export function NewsSection({title, moreLabel, items}: NewsSectionProps) {
  const placeholders = [
    'linear-gradient(135deg,var(--color-primary-soft-hover),var(--hhc-news-panel)),radial-gradient(circle at 20% 25%,rgb(228 164 58 / 62%) 0 18%,transparent 19%)',
    'linear-gradient(135deg,rgb(58 126 122 / 26%),var(--hhc-news-panel)),radial-gradient(circle at 78% 28%,rgb(189 223 227 / 54%) 0 22%,transparent 23%)',
    'linear-gradient(135deg,rgb(228 164 58 / 30%),var(--hhc-news-panel)),radial-gradient(circle at 22% 76%,rgb(207 104 95 / 34%) 0 24%,transparent 25%)'
  ];

  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-center justify-between gap-5">
        <h2 className="m-0 text-2xl font-semibold tracking-[0.03em] text-ink">{title}</h2>
        <a className="inline-flex min-h-11 items-center text-sm font-extrabold text-rose" href="#">
          {moreLabel}
        </a>
      </div>
      <ul className="m-0 grid list-none gap-5 p-0">
        {items.map((item, index) => (
          <li key={item.id}>
            <a className="grid grid-cols-[210px_minmax(0,1fr)] items-center gap-5 max-[900px]:grid-cols-[160px_minmax(0,1fr)] max-[620px]:grid-cols-1" href={item.href}>
              <span
                aria-label={item.imageAlt}
                role="img"
                className="h-24 w-[210px] rounded-[10px] bg-panel bg-cover bg-center ring-1 ring-panel-border max-[900px]:w-40 max-[620px]:h-40 max-[620px]:w-full"
                style={{backgroundImage: placeholders[index % placeholders.length]}}
              />
              <span>
                <h3 className="mb-2 text-lg font-semibold leading-[1.45]">{item.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-muted">{item.summary}</p>
                <span className="text-[13px] font-bold text-muted">● {item.date}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
