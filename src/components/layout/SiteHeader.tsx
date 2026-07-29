'use client';

import Link from 'next/link';
import Image from 'next/image';
import {Button, Drawer} from '@hallelujahhomechurch/ui';
import {useTranslations} from 'next-intl';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {Locale} from '@/i18n/locales';
import {AccountControl} from './AccountControl';

type SiteHeaderProps = {
  locale: Locale;
  pathname: string;
  sessionClient?: AccountSessionClient;
};

export function SiteHeader({locale, pathname, sessionClient}: SiteHeaderProps) {
  const t = useTranslations('site');
  const navItems = [
    {href: `/${locale}/about`, label: t('nav.about')},
    {href: `/${locale}/literature-ministry`, label: t('nav.literatureMinistry')}
  ];

  return (
      <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/90 backdrop-blur-xl">
      <div className="relative flex min-h-[76px] w-full items-center gap-6 px-6 max-[620px]:min-h-[68px] max-[620px]:px-4">
        <Link href={`/${locale}`} className="inline-flex min-h-11 min-w-max items-center gap-2.5" aria-label={t('nav.home')}>
          <span className="grid size-10 shrink-0 place-items-center max-[620px]:size-9" aria-hidden="true">
            <Image src="/assets/brand/logo.png" alt="" width={40} height={40} className="h-full w-full object-contain" />
          </span>
          <span className="grid gap-0.5 leading-none">
            <strong className="text-[19px] font-medium tracking-[0.02em] text-[var(--hhc-brand-ui)] max-[620px]:text-[17px]">{t('name')}</strong>
            {locale !== 'en' ? (
              <small className="text-[9px] font-extrabold uppercase tracking-[0.02em] text-[var(--hhc-brand-muted)] max-[620px]:text-[8px]">
                {t('englishName')}
              </small>
            ) : null}
          </span>
        </Link>
        <nav
          id="site-navigation"
          className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-stretch max-[620px]:hidden"
          aria-label="主要導覽"
        >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                data-active={pathname === item.href ? 'true' : undefined}
                className="relative inline-flex items-center px-4 font-semibold tracking-[0.02em] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary hover:text-primary hover:after:scale-x-100 data-[active=true]:text-primary data-[active=true]:after:scale-x-100 max-[620px]:min-h-11 max-[620px]:rounded-full max-[620px]:bg-panel max-[620px]:after:hidden"
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="ml-auto hidden max-[620px]:block">
          <Drawer
            closeLabel={t('nav.closeMenu')}
            placement="right"
            title={t('nav.openMenu')}
            trigger={
              <Button type="button" variant="ghost" aria-label={t('nav.openMenu')} className="site-mobile-menu-trigger">
                <span className="grid gap-1.5" aria-hidden="true">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </Button>
            }
          >
            {(close) => (
              <nav className="site-mobile-navigation" aria-label="主要導覽">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} onClick={close}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </Drawer>
        </div>
        <div className="ml-auto shrink-0 max-[620px]:ml-0">
          <AccountControl
            client={sessionClient}
            labels={{
              menu: t('account.menu'),
              manageAccount: t('account.manageAccount'),
              signIn: t('account.signIn'),
              signOut: t('account.signOut'),
              signOutError: t('account.signOutError')
            }}
          />
        </div>
      </div>
      </header>
  );
}
