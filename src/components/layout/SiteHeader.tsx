'use client';

import {useEffect, useRef, useState, useSyncExternalStore, type MouseEvent} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {BookOpenText, House, Newspaper, UsersRound} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {SiteLayout} from '@/features/site-layout/types';
import type {Locale} from '@/i18n/locales';
import {isIPhoneDevice, isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {AccountControlSlot} from './AccountControl';

export type SiteHeaderProps = {
  layout: SiteLayout;
  locale: Locale;
  pathname: string;
  sessionClient?: AccountSessionClient;
  showNavigation?: boolean;
};

const subscribeToStandaloneMode = () => () => undefined;
const getIPhoneStandaloneSnapshot = () => isIPhoneDevice() && isStandaloneWebApp();
const getServerStandaloneSnapshot = () => false;

const icons = {
  about: UsersRound,
  news: Newspaper,
  'literature-ministry': BookOpenText
};

export function SiteHeader({layout, locale, pathname, sessionClient, showNavigation = true}: SiteHeaderProps) {
  const t = useTranslations('site');
  const homeHref = `/${locale}`;
  const navItems = layout.header.filter(({visible}) => visible).map((item) => ({...item, icon: icons[item.key]}));
  const mobileNavItems = [{key: 'home', label: t('nav.home'), href: homeHref, icon: House}, ...navItems];
  const accountLabels = {
    menu: t('account.menu'),
    projectionSystem: t('account.projectionSystem'),
    adminManagement: t('account.adminManagement'),
    manageAccount: t('account.manageAccount'),
    signIn: t('account.signIn'),
    signOut: t('account.signOut'),
    signOutError: t('account.signOutError')
  };
  const isActive = (href: string) => pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`));
  const mobileActiveIndex = mobileNavItems.findIndex(({href}) => isActive(href));
  const [mobileSelection, setMobileSelection] = useState({pathname, index: mobileActiveIndex});
  const mobileIndicatorIndex = mobileSelection.pathname === pathname ? mobileSelection.index : mobileActiveIndex;
  const delayedMobileHref = useRef<string | null>(null);
  const mobileNavigationFrame = useRef(0);
  const [mobileChrome, setMobileChrome] = useState({pathname, visible: true});
  const iphoneStandalone = useSyncExternalStore(
    subscribeToStandaloneMode,
    getIPhoneStandaloneSnapshot,
    getServerStandaloneSnapshot
  );
  const mobileChromeVisible = mobileChrome.pathname === pathname ? mobileChrome.visible : true;
  const navigateMobile = (event: MouseEvent<HTMLAnchorElement>, href: string, index: number) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return;
    if (delayedMobileHref.current === href) {
      delayedMobileHref.current = null;
      return;
    }
    if (mobileNavigationFrame.current) window.cancelAnimationFrame(mobileNavigationFrame.current);
    event.preventDefault();
    setMobileSelection({pathname, index});
    const link = event.currentTarget;
    mobileNavigationFrame.current = window.requestAnimationFrame(() => {
      mobileNavigationFrame.current = window.requestAnimationFrame(() => {
        mobileNavigationFrame.current = 0;
        delayedMobileHref.current = href;
        link.click();
      });
    });
  };

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
    <>
      <header className="site-header sticky top-0 z-10 border-b border-line/70 backdrop-blur-xl" data-mobile-hidden={!mobileChromeVisible} data-iphone-standalone={iphoneStandalone || undefined}>
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
        {showNavigation ? <nav
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
        </nav> : null}
        <div className="ml-auto shrink-0">
          <AccountControlSlot client={sessionClient} labels={accountLabels} />
        </div>
      </div>
      </header>
      {showNavigation ? <nav className="site-mobile-tab-bar" style={{gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))`}} aria-label={t('nav.menu')} data-mobile-hidden={!mobileChromeVisible} data-iphone-standalone={iphoneStandalone || undefined}>
        <span aria-hidden="true" className="site-mobile-tab-indicator" data-mobile-nav-indicator data-visible={mobileIndicatorIndex >= 0} style={{transform: `translate3d(${Math.max(0, mobileIndicatorIndex) * 100}%, 0, 0)`}} />
        {mobileNavItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const visualActive = mobileIndicatorIndex === index;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} data-active={visualActive || undefined} style={{gridColumn: index + 1, gridRow: 1}} onClick={(event) => navigateMobile(event, item.href, index)}>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav> : null}
    </>
  );
}
