'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useState} from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import {useTranslations} from 'next-intl';
import type {Locale} from '@/i18n/locales';

type SiteHeaderProps = {
  locale: Locale;
  pathname: string;
};

export function SiteHeader({locale, pathname}: SiteHeaderProps) {
  const t = useTranslations('site');
  const [isOpen, setIsOpen] = useState(false);
  const navItems = [
    {href: `/${locale}/about`, label: t('nav.about')},
    {href: `/${locale}/literature-ministry`, label: t('nav.literatureMinistry')}
  ];

  return (
    <Collapsible.Root asChild open={isOpen} onOpenChange={setIsOpen}>
      <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/90 backdrop-blur-xl">
      <div className="shell relative flex min-h-[76px] items-center gap-6 max-[620px]:min-h-[68px]">
        <Link href={`/${locale}`} className="inline-flex min-h-11 min-w-max items-center gap-2.5" aria-label={t('nav.home')}>
          <span className="grid size-10 shrink-0 place-items-center max-[620px]:size-9" aria-hidden="true">
            <Image src="/assets/brand/logo.png" alt="" width={40} height={40} className="h-full w-full object-contain" />
          </span>
          <span className="grid gap-0.5 leading-none">
            <strong className="text-[19px] font-medium tracking-[0.02em] text-[#403832] max-[620px]:text-[17px]">{t('name')}</strong>
            {locale !== 'en' ? (
              <small className="text-[9px] font-extrabold uppercase tracking-[0.02em] text-[#6f6660] max-[620px]:text-[8px]">
                {t('englishName')}
              </small>
            ) : null}
          </span>
        </Link>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            aria-label={isOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            className="ml-auto hidden size-11 items-center justify-center rounded-full border border-panel-border bg-panel text-ink shadow-[inset_0_1px_0_rgb(255_255_255_/_58%)] max-[620px]:inline-flex"
          >
            <span className="grid gap-1.5" aria-hidden="true">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content forceMount asChild>
          <nav
            id="site-navigation"
            className="ml-auto flex items-center gap-5 data-[state=closed]:max-[620px]:hidden data-[state=open]:max-[620px]:grid max-[620px]:absolute max-[620px]:left-0 max-[620px]:right-0 max-[620px]:top-full max-[620px]:ml-0 max-[620px]:rounded-b-[14px] max-[620px]:border-x max-[620px]:border-b max-[620px]:border-line max-[620px]:bg-paper max-[620px]:p-4 max-[620px]:shadow-warm"
            aria-label="主要導覽"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className="inline-flex min-h-11 items-center px-1 font-extrabold tracking-[0.02em] hover:text-primary max-[620px]:rounded-full max-[620px]:bg-panel max-[620px]:px-4"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </Collapsible.Content>
      </div>
      </header>
    </Collapsible.Root>
  );
}
