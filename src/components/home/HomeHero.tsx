type HomeHeroProps = {
  title: string;
  subtitle: string;
};

export function HomeHero({title, subtitle}: HomeHeroProps) {
  return (
    <section
      className="relative min-h-[clamp(430px,56vw,610px)] overflow-hidden bg-paper"
      aria-labelledby="hero-title"
      style={{
        backgroundImage:
          'linear-gradient(90deg, rgb(255 253 249 / 86%) 0 46%, rgb(255 253 249 / 44%) 68%, rgb(255 253 249 / 14%)), url("/assets/banners/hero.jpg")',
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }}
    >
      <div className="shell relative z-2 flex min-h-[clamp(430px,56vw,610px)] items-center py-[70px] pb-[88px] max-[620px]:py-12 max-[620px]:pb-16">
        <div className="max-w-[590px] pt-8 max-[620px]:pt-0">
          <h1 id="hero-title" className="font-display text-[clamp(54px,8vw,96px)] font-normal leading-[1.08] tracking-[0.08em] text-[#8f2e22] max-[620px]:tracking-[0.03em]">
            {title}
          </h1>
          <p className="mt-5 text-[clamp(18px,2.1vw,26px)] font-semibold tracking-[0.06em] text-[#6f352c]">{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
