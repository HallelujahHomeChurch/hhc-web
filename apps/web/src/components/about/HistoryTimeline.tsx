import Image from 'next/image';
import type {HistoryTimelinePayload} from '@/features/history/types';

type HistoryTimelineProps = {
  content: {
    scripture: {lines: string[]; cite: string}[];
    imageAlt: string;
    intro: string;
    title: string;
  };
  timeline: HistoryTimelinePayload;
  errorMessage?: string;
};

export function HistoryTimeline({content, timeline, errorMessage}: HistoryTimelineProps) {
  return (
    <article className="shell mt-7 overflow-hidden rounded-2xl border border-line/80 bg-paper/90 px-[38px] py-[34px] shadow-warm max-[620px]:px-5 max-[620px]:py-6">
      <div className="mb-[34px] grid grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] items-center gap-[30px] overflow-hidden rounded-[14px] border border-panel-border bg-panel p-[clamp(24px,4vw,44px)] shadow-[inset_0_1px_0_var(--hhc-inset-highlight)] max-[900px]:grid-cols-1">
        <div className="grid gap-7 font-display text-[clamp(16px,1.55vw,20px)] leading-[1.8] tracking-[0.04em] text-[var(--hhc-brand-strong)]">
          {content.scripture.map((quote) => (
            <blockquote key={quote.cite} className="m-0">
              {quote.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <cite className="mt-2 block text-center text-[clamp(13px,.72em,14px)] not-italic">{quote.cite}</cite>
            </blockquote>
          ))}
        </div>
        <Image
          src="/assets/about/process-illustration.png"
          alt={content.imageAlt}
          width={520}
          height={430}
          className="max-h-[430px] w-full object-contain [mix-blend-mode:var(--hhc-artwork-blend,multiply)]"
        />
      </div>
      <p className="mb-[34px] max-w-[760px] text-lg leading-[1.9] text-muted">{content.intro}</p>
      <section className="border-t border-line py-[42px]" aria-labelledby="history-main-title">
        <h2 id="history-main-title" className="mb-7 font-display text-[clamp(42px,6vw,76px)] font-normal leading-[1.08] tracking-[0.06em] text-[var(--hhc-brand-strong)]">
          {content.title}
        </h2>
        {errorMessage ? <p role="status" className="rounded-lg border border-line bg-panel p-4 text-muted">{errorMessage}</p> : <ol className="relative grid list-none grid-cols-2 gap-x-14 gap-y-5 p-0 before:absolute before:bottom-0 before:left-1/2 before:top-0 before:w-0.5 before:-translate-x-px before:bg-[linear-gradient(var(--color-rose),var(--color-teal))] before:opacity-55 max-[760px]:grid-cols-1 max-[760px]:gap-4 max-[760px]:pl-5 max-[760px]:before:left-[3px]">
          {timeline.events.map((event, index) => (
            <li
              key={`${event.date}-${event.body}`}
              className={`relative rounded-2xl border border-line/80 bg-[image:var(--hhc-panel-gradient)] px-6 py-5 shadow-warm before:absolute before:top-[30px] before:size-3.5 before:rounded-full before:shadow-[0_0_0_6px_var(--hhc-timeline-ring)] max-[760px]:col-start-1 max-[760px]:translate-y-0 max-[760px]:before:-left-[21px] ${
                index % 2 === 0
                  ? 'col-start-1 translate-y-2.5 before:-right-[34px] before:bg-rose'
                  : 'col-start-2 translate-y-[54px] before:-left-[34px] before:bg-teal'
              }`}
            >
              <time className={`mb-2.5 inline-flex rounded-full bg-[var(--hhc-footer)] px-3 py-1.5 text-base font-black leading-none ${event.continued ? 'text-muted' : 'text-[var(--hhc-brand-strong)]'}`}>
                {event.date}
              </time>
              <p className="m-0 text-base leading-[1.8] text-ink">{event.body}</p>
            </li>
          ))}
        </ol>}
      </section>
    </article>
  );
}
