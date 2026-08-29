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
    ? 'text-[clamp(44px,5.8vw,76px)] tracking-[0.03em] max-[620px]:whitespace-normal max-[620px]:text-[clamp(34px,10vw,46px)] max-[620px]:tracking-[0.01em]'
    : locale === 'ko'
      ? 'text-[clamp(46px,6vw,80px)] tracking-[0.01em] max-[620px]:whitespace-normal max-[620px]:text-[clamp(34px,10vw,46px)] max-[620px]:tracking-[0]'
      : 'text-[clamp(58px,8.5vw,104px)] tracking-[0.08em] max-[620px]:text-[clamp(36px,12vw,56px)] max-[620px]:tracking-[0.03em]';
  const subtitleTypography = locale === 'ja'
    ? 'text-[clamp(24px,3.5vw,36px)] tracking-[0.03em] max-[620px]:text-[clamp(21px,7vw,29px)]'
    : locale === 'ko'
      ? 'text-[clamp(24px,3.5vw,36px)] tracking-[0.01em] max-[620px]:text-[clamp(21px,7vw,29px)]'
      : 'text-[clamp(26px,3.5vw,40px)] tracking-[0.06em] max-[620px]:text-[clamp(22px,7vw,30px)]';

  return (
    <section
      className="relative min-h-[clamp(430px,56vw,610px)] overflow-hidden bg-paper"
      aria-labelledby="page-title"
    >
      <picture className="absolute inset-0">
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
        <div className="min-w-0 max-w-[680px] pt-8 max-[620px]:pt-0">
          <h1 id="page-title" className={`${displayFont} ${titleTypography} whitespace-nowrap font-normal leading-[1.08] text-[var(--hhc-brand-strong)]`}>
            {title}
          </h1>
          <p className={`${displayFont} ${subtitleTypography} mt-5 font-normal text-[var(--hhc-brand-copy)]`}>{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
