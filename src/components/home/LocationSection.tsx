import type {LocationItem} from '@/features/locations/types';

type LocationSectionProps = {
  title: string;
  mapLabel: string;
  items: LocationItem[];
};

export function LocationSection({title, mapLabel, items}: LocationSectionProps) {
  return (
    <section className="shell mt-7" aria-labelledby="locations-title">
      <h2 id="locations-title" className="mb-4 w-max border-b-[3px] border-teal text-[25px] font-bold text-teal">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        {items.map((item, index) => (
          <article key={item.id} className="grid grid-cols-[90px_1fr] items-center gap-5 rounded-2xl border border-line/80 bg-paper/90 p-5 shadow-warm max-[620px]:grid-cols-1">
            <div className={`grid size-[74px] place-items-center rounded-full text-[42px] ${index === 0 ? 'bg-[#dfefea] text-teal' : 'bg-[#f5dddd] text-rose'}`} aria-hidden="true">
              ⌂
            </div>
            <div>
              <h3 className="mb-1.5 text-lg font-bold">{item.name}</h3>
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
