'use client';

import {useEffect, useState, useSyncExternalStore} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {BookOpenText, Newspaper, UsersRound} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import type {Locale} from '@/i18n/locales';
import {isIPhoneDevice, isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {AccountControlProvider, AccountControlView} from './AccountControl';

export type SiteHeaderProps = {
  layout: SiteLayout;
  locale: Locale;
  pathname: string;
  sessionClient?: AccountSessionClient;
};

const subscribeToStandaloneMode = () => () => undefined;
const getIPhoneStandaloneSnapshot = () => isIPhoneDevice() && isStandaloneWebApp();
const getServerStandaloneSnapshot = () => false;

const icons = {
  about: UsersRound,
  news: Newspaper,
  'literature-ministry': BookOpenText
};

export function SiteHeader({layout, locale, pathname, sessionClient}: SiteHeaderProps) {
  const t = useTranslations('site');
  const navItems = layout.header.filter(({visible}) => visible).map((item) => ({...item, icon: icons[item.key]}));
  const accountLabels = {
    menu: t('account.menu'),
    manageAccount: t('account.manageAccount'),
    signIn: t('account.signIn'),
    signOut: t('account.signOut'),
    signOutError: t('account.signOutError')
  };
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const [mobileChrome, setMobileChrome] = useState({pathname, visible: true});
  const iphoneStandalone = useSyncExternalStore(
    subscribeToStandaloneMode,
    getIPhoneStandaloneSnapshot,
    getServerStandaloneSnapshot
  );
  const mobileChromeVisible = mobileChrome.pathname === pathname ? mobileChrome.visible : true;

  useEffect(() => {
    let previousY = window.scrollY;
    let direction = 0;
    let distance = 0;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - previousY;
        const nextDirection = Math.sign(delta);
        if (nextDirection && nextDirection !== direction) {
          direction = nextDirection;
          distance = 0;
        }
        distance += Math.abs(delta);
        if (currentY <= 16) {
          setMobileChrome({pathname, visible: true});
          distance = 0;
        } else if (distance >= 16) {
          setMobileChrome({pathname, visible: direction < 0});
          distance = 0;
        }
        previousY = currentY;
        frame = 0;
      });
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <AccountControlProvider client={sessionClient} labels={accountLabels}>
      <header className="site-header sticky top-0 z-10 border-b border-line/70 bg-paper/90 backdrop-blur-xl" data-mobile-hidden={!mobileChromeVisible}>
      <div className="relative flex min-h-[76px] w-full items-center gap-6 px-6 max-[767px]:min-h-[68px] max-[767px]:px-4">
        <Link href={`/${locale}`} className="inline-flex min-h-11 min-w-max items-center gap-2.5 max-[767px]:min-w-0 max-[767px]:flex-1">
          <span className="grid size-10 shrink-0 place-items-center max-[767px]:size-9" aria-hidden="true">
            <Image src="/assets/brand/logo.png" alt="" width={40} height={40} className="h-full w-full object-contain" />
          </span>
          <span className="grid min-w-0 gap-0.5 leading-none">
            <strong className="truncate text-[19px] font-medium tracking-[0.02em] text-[var(--hhc-brand-ui)] max-[767px]:text-[17px]">{layout.siteName}</strong>
            {locale !== 'en' ? (
              <small className="text-[9px] font-extrabold uppercase tracking-[0.02em] text-[var(--hhc-brand-muted)] max-[767px]:text-[8px]">
                {layout.englishName}
              </small>
            ) : null}
          </span>
        </Link>
        <nav
          id="site-navigation"
          className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-stretch max-[767px]:hidden"
          aria-label={t('nav.primary')}
        >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                data-active={isActive(item.href) ? 'true' : undefined}
                className="relative inline-flex items-center px-4 font-semibold tracking-[0.02em] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary hover:text-primary hover:after:scale-x-100 data-[active=true]:text-primary data-[active=true]:after:scale-x-100"
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="ml-auto shrink-0">
          <AccountControlView />
        </div>
      </div>
      </header>
      <nav className="site-mobile-tab-bar" aria-label={t('nav.menu')} data-mobile-hidden={!mobileChromeVisible} data-iphone-standalone={iphoneStandalone || undefined}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} data-active={active || undefined}>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </AccountControlProvider>
  );
}
