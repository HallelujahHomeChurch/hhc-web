import Image from 'next/image';

type VisionSection = {
  eyebrow: string;
  title: string;
  body?: string;
  cards?: {title: string; body: string}[];
};

type VisionContentProps = {
  content: {
    intro: string;
    imageAlt: string;
    actionsImageAlt: string;
    sections: VisionSection[];
  };
};

export function VisionContent({content}: VisionContentProps) {
  const [vision, goals, actions, convictions] = content.sections as [VisionSection, VisionSection, VisionSection, VisionSection];

  return (
    <article className="shell rounded-2xl border border-line/80 bg-paper/90 px-[38px] py-[34px] text-lg leading-loose shadow-warm max-[620px]:px-5 max-[620px]:py-6">
      <p className="mb-[34px]">{content.intro}</p>

      <section className="border-t border-line py-[30px]" aria-labelledby="vision-title">
        <div className="mb-[18px] flex items-baseline gap-3.5">
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{vision.eyebrow}</span>
          <h2 id="vision-title" className="m-0 text-[28px] font-semibold leading-tight text-ink">
            {vision.title}
          </h2>
        </div>
        <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
          <p className="m-0 text-base leading-loose text-ink">{vision.body}</p>
          <div className="overflow-hidden rounded-[14px] border border-panel-border bg-panel p-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_58%)]">
            <Image
              src="/assets/about/vision-unity-prayer.png"
              alt={content.imageAlt}
              width={720}
              height={540}
              className="aspect-[4/3] h-full w-full rounded-[10px] object-cover"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-[30px]" aria-labelledby="goals-title">
        <div className="mb-[18px] flex items-baseline gap-3.5">
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{goals.eyebrow}</span>
          <h2 id="goals-title" className="m-0 text-[28px] font-semibold leading-tight text-ink">
            {goals.title}
          </h2>
        </div>
        <p className="m-0 text-base leading-loose text-ink">{goals.body}</p>
      </section>

      <section className="border-t border-line py-[30px]" aria-labelledby="actions-title">
        <div className="mb-[18px] flex items-baseline gap-3.5">
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{actions.eyebrow}</span>
          <h2 id="actions-title" className="m-0 text-[28px] font-semibold leading-tight text-ink">
            {actions.title}
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
          {actions.cards?.map((card) => (
            <article key={card.title} className="rounded-[14px] border border-panel-border bg-panel p-5 shadow-[inset_0_1px_0_rgb(255_255_255_/_58%)]">
              <strong className="mb-2.5 block text-lg font-semibold text-[#b64e45]">{card.title}</strong>
              <p className="text-base leading-[1.8] text-muted">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-[30px]" aria-labelledby="convictions-title">
        <div className="mb-[18px] flex items-baseline gap-3.5">
          <span className="text-base font-black uppercase tracking-[0.12em] text-rose">{convictions.eyebrow}</span>
          <h2 id="convictions-title" className="m-0 text-[28px] font-semibold leading-tight text-ink">
            {convictions.title}
          </h2>
        </div>
        <div className="grid grid-cols-2 items-start gap-6 max-[900px]:grid-cols-1">
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 max-[900px]:grid-cols-1">
            {convictions.cards?.map((card) => (
              <li key={card.title} className="rounded-[14px] border border-panel-border bg-panel p-5 leading-[1.85] text-muted shadow-[inset_0_1px_0_rgb(255_255_255_/_58%)]">
                <strong className="mb-2 block text-lg font-semibold text-[#b64e45]">{card.title}</strong>
                {card.body}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2.5 overflow-hidden rounded-[14px] border border-panel-border bg-panel p-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_58%)]" aria-label={content.actionsImageAlt}>
            <Image src="/assets/about/vision-actions-space.png" alt="" width={720} height={405} className="col-span-2 aspect-video h-full w-full rounded-[10px] object-cover" />
            <Image src="/assets/about/vision-actions-worship.png" alt="" width={360} height={225} className="aspect-[16/10] h-full w-full rounded-[10px] object-cover" />
            <Image src="/assets/about/vision-actions-community.png" alt="" width={360} height={225} className="aspect-[16/10] h-full w-full rounded-[10px] object-cover" />
          </div>
        </div>
      </section>
    </article>
  );
}
