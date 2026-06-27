import type {NewsItem} from '@/features/news/types';

type NewsSectionProps = {
  title: string;
  moreLabel: string;
  items: NewsItem[];
};

export function NewsSection({title, moreLabel, items}: NewsSectionProps) {
  const placeholders = [
    'linear-gradient(135deg,rgb(207_104_95_/_28%),rgb(248_240_231_/_88)),radial-gradient(circle_at_20%_25%,rgb(228_164_58_/_62%)_0_18%,transparent_19%)',
    'linear-gradient(135deg,rgb(58_126_122_/_26%),rgb(248_240_231_/_90)),radial-gradient(circle_at_78%_28%,rgb(189_223_227_/_74%)_0_22%,transparent_23%)',
    'linear-gradient(135deg,rgb(228_164_58_/_30%),rgb(248_240_231_/_88)),radial-gradient(circle_at_22%_76%,rgb(207_104_95_/_34%)_0_24%,transparent_25%)'
  ];

  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-center justify-between gap-5">
        <h2 className="m-0 text-2xl font-bold tracking-[0.03em] text-ink">{title}</h2>
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
                <h3 className="mb-2 text-lg font-bold leading-[1.45]">{item.title}</h3>
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
