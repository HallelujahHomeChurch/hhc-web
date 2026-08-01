type AboutHeroProps = {
  title: string;
  subtitle: string;
};

export function AboutHero({title, subtitle}: AboutHeroProps) {
  return (
    <section
      className="relative min-h-[clamp(430px,56vw,610px)] overflow-hidden bg-paper"
      aria-labelledby="page-title"
      style={{
        backgroundImage:
          'var(--hhc-hero-overlay), url("/assets/banners/hero.jpg")',
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }}
    >
      <div className="shell relative z-[2] flex min-h-[clamp(430px,56vw,610px)] items-center py-[70px] pb-[88px] max-[620px]:py-12 max-[620px]:pb-16">
        <div className="max-w-[590px] pt-8 max-[620px]:pt-0">
          <h1 id="page-title" className="font-display whitespace-nowrap text-[clamp(54px,8vw,96px)] font-normal leading-[1.08] tracking-[0.08em] text-[var(--hhc-brand-strong)] max-[620px]:text-[clamp(34px,12vw,54px)] max-[620px]:tracking-[0.03em]">
            {title}
          </h1>
          <p className="font-display mt-5 text-[clamp(22px,2.5vw,32px)] font-normal tracking-[0.06em] text-[var(--hhc-brand-copy)]">{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
