import type {WeeklyBulletin} from '@/features/weekly/types';
import {Button} from '@/components/ui/Button';

type WeeklyCardProps = {
  weekly: WeeklyBulletin;
  ctaLabel: string;
};

export function WeeklyCard({weekly, ctaLabel}: WeeklyCardProps) {
  return (
    <aside className="grid min-h-[350px] place-items-center rounded-[14px] border border-panel-border bg-panel px-6 py-8 text-center shadow-[inset_0_1px_0_var(--hhc-inset-highlight)] max-[900px]:order-first" aria-labelledby="weekly-title">
      <div>
        <div className="mx-auto mb-6 grid size-28 place-items-center rounded-full bg-[var(--hhc-badge-rose)] text-5xl text-primary-hover" aria-hidden="true">
          ▤
        </div>
        <p className="mb-1 text-[21px] font-semibold text-primary">{weekly.date}</p>
        <h3 id="weekly-title" className="mb-1 text-[21px] font-semibold text-ink">
          {weekly.title}
        </h3>
        <p className="mb-6 text-[15px] text-ink">{weekly.subtitle}</p>
        <Button href={weekly.href}>{ctaLabel}</Button>
      </div>
    </aside>
  );
}
