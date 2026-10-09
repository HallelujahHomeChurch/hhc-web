'use client';

import {useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent} from 'react';
import {useScrollChrome} from './useScrollChrome';
import Link from 'next/link';
import Image from 'next/image';
import {BookOpenText, Newspaper, PlaySquare, UsersRound} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {VideoSearchField} from '@/features/member-videos/VideoSearchField';
import {ExpandableSearchField} from '@hallelujahhomechurch/ui';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {SiteLayout} from '@/features/site-layout/types';
import type {Locale} from '@/i18n/locales';
import {isIPhoneDevice, isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {StatementStrip} from '@/components/statements/StatementStrip';
import {LineBrowserNotice, useLineBrowserNotice} from './LineBrowserNotice';
import {AccountControlScope, AccountControlView, useNavigationPresentation} from './AccountControl';

export type SiteHeaderProps = {
  layout: SiteLayout;
  locale: Locale;
  pathname: string;
  sessionClient?: AccountSessionClient;
  showNavigation?: boolean;
  searchQuery?: string;
};

const subscribeToStandaloneMode = () => () => undefined;
const getIPhoneStandaloneSnapshot = () => isIPhoneDevice() && isStandaloneWebApp();
const getServerStandaloneSnapshot = () => false;

const icons = {
  about: UsersRound,
  news: Newspaper,
  'literature-ministry': BookOpenText,
  'member-videos': PlaySquare
};

export function SiteHeader(props: SiteHeaderProps) {
  const t = useTranslations('site');
  const accountLabels = {
    menu: t('account.menu'),
    projectionSystem: t('account.projectionSystem'),
    projectionWindowLabel: t('account.projectionWindowLabel'),
    projectionPopupBlocked: t('account.projectionPopupBlocked'),
    adminManagement: t('account.adminManagement'),
    manageAccount: t('account.manageAccount'),
    signIn: t('account.signIn'),
    signOut: t('account.signOut'),
    signOutError: t('account.signOutError'),
    unsyncedWarning: t('account.unsyncedWarning')
  };
  return <AccountControlScope client={props.sessionClient} labels={accountLabels}><SiteHeaderContent {...props} /></AccountControlScope>;
}

function SiteHeaderContent({layout, locale, pathname, showNavigation = true, searchQuery = ''}: SiteHeaderProps) {
  const lineNotice = useLineBrowserNotice(pathname);
  const t = useTranslations('site');
  const homeHref = `/${locale}`;
  const navigation = useNavigationPresentation();
  const canReadBulletin = navigation.sources.operations?.ids.includes('literature-ministry') === true;
  const canWatchVideo = navigation.sources.operations?.ids.includes('member-videos') === true;
  const navItems = [
    ...layout.header.filter(({key, visible}) => visible && (key !== 'literature-ministry' || canReadBulletin)).map((item) => ({...item, icon: icons[item.key]})),
    ...(process.env.NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED === 'true' && canWatchVideo ? [{key: 'member-videos', label: t('nav.memberVideos'), href: `/${locale}/member-videos`, visible: true, icon: PlaySquare}] : [])
  ];
  const mobileNavItems = [
    navItems.find(item => item.key === 'literature-ministry') ?? navItems.find(item => item.key === 'news'),
    navItems.find(item => item.key === 'member-videos') ?? navItems.find(item => item.key === 'about')
  ].filter((item): item is typeof navItems[number] => Boolean(item));
  const videoRoot = `/${locale}/member-videos`;
  const videoWatchPage = pathname.startsWith(`${videoRoot}/`) && pathname !== `${videoRoot}/`;
  const videoSearchEnabled = pathname === videoRoot || pathname.startsWith(`${videoRoot}/`);
  const searchKey = `${pathname}:${searchQuery}`;
  const [searchState, setSearchState] = useState({pathname:searchKey, open: false});
  const searchOpen = searchState.pathname === searchKey && searchState.open;
  const rowRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [searchLayout, setSearchLayout] = useState({replaceNav: false, start: 0, end: 0});
  useLayoutEffect(() => {
    const row = rowRef.current, brand = brandRef.current, nav = navRef.current, account = accountRef.current;
    if (!row || !brand || !account) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const bounds = row.getBoundingClientRect(), brandBounds = brand.getBoundingClientRect(), accountBounds = account.getBoundingClientRect();
      const next = {replaceNav: Boolean(nav && nav.getBoundingClientRect().right + 16 > accountBounds.left - 16 - 280), start: brandBounds.right - bounds.left + 16, end: bounds.right - accountBounds.left + 16};
      setSearchLayout(previous => previous.replaceNav === next.replaceNav && previous.start === next.start && previous.end === next.end ? previous : next);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    for (const element of [row, brand, nav, account]) if (element) observer?.observe(element);
    queueMicrotask(measure);
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => {active = false; observer?.disconnect(); window.removeEventListener('resize', measure);};
  }, [locale, navItems.length]);

  const isActive = (href: string) => pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`));
  const mobileActiveIndex = mobileNavItems.findIndex(({href}) => isActive(href));
  const [mobileSelection, setMobileSelection] = useState({pathname, href: mobileNavItems[mobileActiveIndex]?.href});
  const mobileIndicatorIndex = mobileSelection.pathname === pathname ? mobileNavItems.findIndex(item => item.href === mobileSelection.href) : mobileActiveIndex;
  const delayedMobileHref = useRef<string | null>(null);
  const mobileNavigationFrame = useRef(0);
  const chromeRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const chrome=chromeRef.current;if(!chrome)return;
    const measure=()=>{
      const height=chrome.getBoundingClientRect().height,viewportHeight=window.visualViewport?.height??window.innerHeight;
      document.documentElement.style.setProperty('--site-top-chrome-height',`${height}px`);
      document.documentElement.style.setProperty('--site-watch-position',viewportHeight-height-window.innerWidth*9/16>=160?'sticky':'static');
    };
    window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
    measure();const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(chrome);
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);document.documentElement.style.removeProperty('--site-top-chrome-height');document.documentElement.style.removeProperty('--site-watch-position');};
  },[]);
  const {visible: mobileChromeVisible} = useScrollChrome({resetKey: pathname, blocked: searchOpen});
  const iphoneStandalone = useSyncExternalStore(
    subscribeToStandaloneMode,
    getIPhoneStandaloneSnapshot,
    getServerStandaloneSnapshot
  );
  const navigateMobile = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return;
    if (delayedMobileHref.current === href) {
      delayedMobileHref.current = null;
      return;
    }
    if (mobileNavigationFrame.current) window.cancelAnimationFrame(mobileNavigationFrame.current);
    event.preventDefault();
    setMobileSelection({pathname, href});
    const link = event.currentTarget;
    mobileNavigationFrame.current = window.requestAnimationFrame(() => {
      mobileNavigationFrame.current = window.requestAnimationFrame(() => {
        mobileNavigationFrame.current = 0;
        delayedMobileHref.current = href;
        link.click();
      });
    });
  };



  return (
    <>
      <div ref={chromeRef} className="site-top-chrome sticky top-0 z-10" data-mobile-hidden={!mobileChromeVisible}>
        <header data-search-open={searchOpen} data-search-replaces-nav={searchLayout.replaceNav} className="site-header border-b border-line/70 backdrop-blur-xl" data-iphone-standalone={iphoneStandalone || undefined}>
          <div ref={rowRef} style={{'--site-search-start': `${searchLayout.start}px`, '--site-search-end': `${searchLayout.end}px`} as CSSProperties} className="site-header-row relative flex min-h-[76px] w-full items-center gap-6 px-6 max-[767px]:min-h-[68px] max-[767px]:px-4">
            <Link ref={brandRef} href={videoWatchPage ? videoRoot : homeHref} aria-label={`${t(videoWatchPage ? 'nav.memberVideos' : 'nav.home')} · ${layout.siteName}`} className="site-header-brand inline-flex min-h-11 min-w-max items-center gap-2.5 max-[767px]:min-w-0 max-[767px]:flex-1">
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
              ref={navRef}
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
            <div className="site-header-controls ml-auto flex shrink-0 items-center gap-4">
              <div className="site-header-search">
                {videoSearchEnabled ? <VideoSearchField key={searchKey} locale={locale} query={searchQuery} isLibrary={pathname===videoRoot} label={t('search.video.label')} submitLabel={t('search.submit')} clearLabel={t('search.clear')} closeLabel={t('search.close')} placeholder={t('search.video.placeholder')} onExpandedChange={open=>setSearchState({pathname:searchKey,open})}/> : <ExpandableSearchField label={t('search.unavailable')} submitLabel={t('search.submit')} clearLabel={t('search.clear')} isDisabled/>}
              </div>
              <div ref={accountRef} className="site-header-account shrink-0" data-mobile-retained={!showNavigation}><AccountControlView /></div>
            </div>
          </div>
        </header>
        {lineNotice.visible ? <LineBrowserNotice pathname={pathname} onClose={lineNotice.close} /> : <StatementStrip />}
      </div>
      {showNavigation ? <nav className="site-mobile-tab-bar" style={{gridTemplateColumns: `repeat(${mobileNavItems.length + 1}, minmax(0, 1fr))`}} aria-label={t('nav.menu')} data-mobile-hidden={!mobileChromeVisible} data-iphone-standalone={iphoneStandalone || undefined}>
        <span aria-hidden="true" className="site-mobile-tab-indicator" data-mobile-nav-indicator data-visible={mobileIndicatorIndex >= 0} style={{transform: `translate3d(${Math.max(0, mobileIndicatorIndex) * 100}%, 0, 0)`}} />
        {mobileNavItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const visualActive = mobileIndicatorIndex === index;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} data-active={visualActive || undefined} style={{gridColumn: index + 1, gridRow: 1}} onClick={(event) => navigateMobile(event, item.href)}>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div className="site-mobile-account" data-label={t('nav.my')} style={{gridColumn: mobileNavItems.length + 1, gridRow: 1}}>
          <AccountControlView menuLabel={t('nav.my')} />
          <span aria-hidden="true">{t('nav.my')}</span>
        </div>
      </nav> : null}
    </>
  );
}
