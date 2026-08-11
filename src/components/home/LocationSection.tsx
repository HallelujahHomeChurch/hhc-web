import type {LocationItem} from '@/features/locations/types';

type LocationSectionProps = {
  title: string;
  mapLabel: string;
  items: LocationItem[];
};

export function LocationSection({title, mapLabel, items}: LocationSectionProps) {
  return (
    <section className="shell mt-7" aria-labelledby="locations-title">
      <h2 id="locations-title" className="mb-4 w-max border-b-[3px] border-teal text-[25px] font-semibold text-teal">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        {items.map((item, index) => (
          <article key={item.id} className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-5 rounded-2xl border border-line/80 bg-paper/90 p-5 shadow-warm max-[620px]:grid-cols-[56px_minmax(0,1fr)] max-[620px]:gap-3 max-[620px]:p-4">
            <div className={`grid size-[74px] place-items-center rounded-full text-[42px] max-[620px]:size-14 max-[620px]:text-3xl ${index === 0 ? 'bg-[var(--hhc-badge-teal)] text-teal' : 'bg-[var(--hhc-badge-rose)] text-rose'}`} aria-hidden="true">
              ⌂
            </div>
            <div>
              <h3 className="mb-1.5 text-lg font-semibold">{item.name}</h3>
              <p className="mb-2.5 text-sm leading-relaxed text-muted">{item.address}</p>
              <a className="inline-flex min-h-11 items-center text-[13px] font-extrabold text-muted hover:text-rose" href={item.mapHref} target="_blank" rel="noreferrer">
                ⌖ {mapLabel}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
