import {Button} from '@/components/ui/Button';
import type {Locale} from '@/i18n/locales';
import Image from 'next/image';

type AboutTeaserProps = {
  locale: Locale;
  title: string;
  body: string;
  ctaLabel: string;
};

export function AboutTeaser({locale, title, body, ctaLabel}: AboutTeaserProps) {
  return (
    <section className="shell mt-7 grid grid-cols-[340px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-line/80 bg-paper/90 shadow-warm max-[900px]:grid-cols-1" aria-labelledby="about-title">
      <div className="relative min-h-[230px] overflow-hidden bg-panel" aria-hidden="true">
        <Image
          src="/assets/banners/testimony.jpg"
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 340px"
          className="object-cover object-[48%_42%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(207_104_95_/_18%),rgb(58_126_122_/_10%))]" />
      </div>
      <div className="px-10 py-8">
        <h2 id="about-title" className="mb-3.5 text-[26px] font-bold text-[#b64e45]">
          {title}
        </h2>
        <p className="mb-5 leading-[1.9] text-ink">{body}</p>
        <Button href={`/${locale}/about`}>{ctaLabel}</Button>
      </div>
    </section>
  );
}
