import type {VideoItem} from '@/features/videos/types';
import {Button} from '@/components/ui/Button';

type VideoSectionProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  channelHref: string;
  items: VideoItem[];
};

export function VideoSection({title, subtitle, ctaLabel, channelHref, items}: VideoSectionProps) {
  return (
    <section className="shell mt-7 grid grid-cols-[230px_repeat(3,minmax(0,1fr))] gap-3.5 rounded-2xl border border-line/80 bg-paper/90 p-3.5 shadow-warm max-[900px]:grid-cols-1" aria-label={title}>
      <div className="px-1.5 py-3">
        <h2 className="mb-3 text-[25px] font-bold text-teal">{title}</h2>
        <p className="mb-5 leading-[1.7] text-ink">{subtitle}</p>
        <div className="mb-4">
          <Button href={channelHref} target="_blank">{ctaLabel}</Button>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-extrabold leading-snug text-muted">
          <span className="grid h-5 w-7 place-items-center rounded-md bg-[#e62117] text-xs text-white" aria-hidden="true">▶</span>
          YouTube
          <br />
          Hallelujah Home Church
        </div>
      </div>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          aria-label={item.imageAlt}
          className="relative min-h-[220px] overflow-hidden rounded-xl bg-panel bg-cover bg-center shadow-[0_14px_34px_rgb(76_50_28_/_9%)] transition hover:translate-y-[-2px] max-[900px]:aspect-video max-[900px]:min-h-0"
          style={{
            backgroundImage: `linear-gradient(180deg, rgb(55 45 43 / 0%) 45%, rgb(55 45 43 / 76%) 100%), url("${item.imageSrc}")`,
            backgroundPosition: 'center, center',
            backgroundSize: '100% 100%, auto 118%'
          }}
        >
          <span className="absolute inset-x-3 bottom-3 rounded-lg px-2.5 py-2 font-extrabold text-white">{item.title}</span>
        </a>
      ))}
    </section>
  );
}
