import Image from 'next/image';
import {chenyuLuoyanBanner, maShanZheng} from '@/app/fonts';
import type {Locale} from '@/i18n/locales';

type HomeHeroProps = {
  locale: Locale;
  title: string;
  subtitle: string;
};

export function HomeHero({locale, title, subtitle}: HomeHeroProps) {
  const displayFont = locale === 'zh-Hans' ? maShanZheng.className : chenyuLuoyanBanner.className;

  return (
    <section
      className="relative min-h-[clamp(430px,56vw,610px)] overflow-hidden bg-paper"
      aria-labelledby="hero-title"
    >
      <picture>
        <Image
          src="/assets/banners/hero.jpg"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center"
        />
      </picture>
      <div className="absolute inset-0 z-[1]" aria-hidden="true" style={{backgroundImage: 'var(--hhc-hero-overlay)'}} />
      <div className="shell relative z-2 flex min-h-[clamp(430px,56vw,610px)] items-center py-[70px] pb-[88px] max-[620px]:py-12 max-[620px]:pb-16">
        <div className="min-w-0 max-w-[590px] pt-8 max-[620px]:pt-0">
          <h1 id="hero-title" className={`${displayFont} whitespace-nowrap text-[clamp(54px,8vw,96px)] font-normal leading-[1.08] tracking-[0.08em] text-[var(--hhc-brand-strong)] max-[620px]:whitespace-normal max-[620px]:text-[clamp(34px,12vw,54px)] max-[620px]:tracking-[0.03em]`}>
            {title}
          </h1>
          <p className={`${displayFont} mt-5 text-[clamp(22px,2.5vw,32px)] font-normal tracking-[0.06em] text-[var(--hhc-brand-copy)]`}>{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
