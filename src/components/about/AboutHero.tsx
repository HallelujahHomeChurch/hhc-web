import Image from 'next/image';
import {bannerFontByLocale} from '@/app/fonts';
import type {Locale} from '@/i18n/locales';

type AboutHeroProps = {
  locale: Locale;
  title: string;
  subtitle: string;
};

export function AboutHero({locale, title, subtitle}: AboutHeroProps) {
  const displayFont = bannerFontByLocale[locale].className;
  const titleTypography = locale === 'ja'
    ? 'text-[clamp(42px,5vw,68px)] tracking-[0.03em] max-[620px]:whitespace-normal max-[620px]:text-[clamp(32px,10vw,44px)] max-[620px]:tracking-[0.01em]'
    : locale === 'ko'
      ? 'text-[clamp(44px,5.5vw,72px)] tracking-[0.01em] max-[620px]:whitespace-normal max-[620px]:text-[clamp(32px,10vw,44px)] max-[620px]:tracking-[0]'
      : 'text-[clamp(54px,8vw,96px)] tracking-[0.08em] max-[620px]:text-[clamp(34px,12vw,54px)] max-[620px]:tracking-[0.03em]';
  const subtitleTypography = locale === 'ja'
    ? 'text-[clamp(20px,2.2vw,28px)] tracking-[0.03em]'
    : locale === 'ko'
      ? 'text-[clamp(20px,2.2vw,28px)] tracking-[0.01em]'
      : 'text-[clamp(22px,2.5vw,32px)] tracking-[0.06em]';

  return (
    <section
      className="relative min-h-[clamp(430px,56vw,610px)] overflow-hidden bg-paper"
      aria-labelledby="page-title"
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
      <div className="shell relative z-[2] flex min-h-[clamp(430px,56vw,610px)] items-center py-[70px] pb-[88px] max-[620px]:py-12 max-[620px]:pb-16">
        <div className="max-w-[590px] pt-8 max-[620px]:pt-0">
          <h1 id="page-title" className={`${displayFont} ${titleTypography} whitespace-nowrap font-normal leading-[1.08] text-[var(--hhc-brand-strong)]`}>
            {title}
          </h1>
          <p className={`${displayFont} ${subtitleTypography} mt-5 font-normal text-[var(--hhc-brand-copy)]`}>{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
