import type {VideoItem} from '@/features/videos/types';
import {Button} from '@/components/ui/Button';
import {Play} from 'lucide-react';
import Image from 'next/image';

type VideoSectionProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  channelHref: string;
  items: VideoItem[];
  errorMessage?: string;
};

export function VideoSection({title, subtitle, ctaLabel, channelHref, items, errorMessage}: VideoSectionProps) {
  return (
    <section className="shell mt-7 grid grid-cols-[230px_repeat(3,minmax(0,1fr))] gap-3.5 rounded-2xl border border-line/80 bg-paper/90 p-3.5 shadow-warm max-[900px]:grid-cols-1" aria-label={title}>
      <div className="px-1.5 py-3">
        <h2 className="mb-3 text-[25px] font-semibold text-teal">{title}</h2>
        <p className="mb-5 leading-[1.7] text-ink">{subtitle}</p>
        <div className="mb-4">
          <Button className="gap-2" href={channelHref} target="_blank">
            <span className="grid h-5 w-7 place-items-center rounded-md bg-[#e62117] text-white" aria-hidden="true">
              <Play size={12} fill="currentColor" />
            </span>
            {ctaLabel}
          </Button>
        </div>
      </div>
      {errorMessage ? <p role="status" className="col-span-3 self-center rounded-lg border border-line bg-panel p-4 text-muted">{errorMessage}</p> : items.map((item) => (
        <a
          key={item.id}
          lang={item.resolvedLocale}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="relative min-h-[220px] overflow-hidden rounded-xl bg-panel shadow-[0_14px_34px_rgb(76_50_28_/_9%)] transition hover:translate-y-[-2px] max-[900px]:aspect-video max-[900px]:min-h-0"
        >
          <Image
            src={item.imageSrc}
            alt={item.imageAlt}
            fill
            sizes="(max-width: 900px) 100vw, 25vw"
            quality={70}
            className="object-cover scale-[1.18]"
          />
          <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(55_45_43_/_0%)_45%,rgb(55_45_43_/_76%)_100%)]" aria-hidden="true" />
          <span className="absolute inset-x-3 bottom-3 rounded-lg px-2.5 py-2 font-semibold text-white">{item.title}</span>
        </a>
      ))}
    </section>
  );
}
