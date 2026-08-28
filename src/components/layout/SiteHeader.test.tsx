import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import en from '@/i18n/locales/en.json';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {SiteHeader} from './SiteHeader';

const anonymousSessionClient: AccountSessionClient = {
  getSession: async () => ({authenticated: false}),
  logout: async () => undefined
};

const layout: SiteLayout = {
  locale: 'zh-Hant',
  siteName: '哈利路亞家教會',
  englishName: 'Hallelujah Home Church',
  copyrightHolder: '社團法人中華民國哈利路亞社區關懷協會',
  allRightsReserved: 'All rights reserved.',
  seoTitleSuffix: '哈利路亞家教會',
  seoDescriptionFallback: '在愛中建造家庭，在真理中成長',
  header: [
    {key: 'about', label: '關於我們', href: '/zh-Hant/about', visible: true},
    {key: 'news', label: '最新消息', href: '/zh-Hant/news', visible: true},
    {key: 'literature-ministry', label: '文字事工', href: '/zh-Hant/literature-ministry', visible: true}
  ],
  legal: [],
  links: {churchYoutube: 'https://youtube.com', churchFacebook: 'https://facebook.com', musicYoutube: 'https://youtube.com'},
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SiteHeader', () => {
  it('renders brand, navigation, and account entry point', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('哈利路亞家教會')).toBeInTheDocument();
    const brandLink = screen.getByRole('link', {name: /哈利路亞家教會/});
    const desktopNavigation = screen.getByRole('navigation', {name: '主要導覽'});
    const aboutLink = within(desktopNavigation).getByRole('link', {name: '關於我們'});
    const newsLinks = screen.getAllByRole('link', {name: '最新消息'});
    const literatureMinistryLink = within(desktopNavigation).getByRole('link', {name: '文字事工'});

    expect(aboutLink).toHaveAttribute('href', '/zh-Hant/about');
    expect(newsLinks[0]).toHaveAttribute('href', '/zh-Hant/news');
    expect(literatureMinistryLink).toHaveAttribute('href', '/zh-Hant/literature-ministry');
    expect(aboutLink).toHaveAttribute('aria-current', 'page');
    expect(aboutLink).toHaveAttribute('data-active', 'true');
    const accountEntry = await screen.findByRole('link', {name: '登入'});
    expect(accountEntry).toBeInTheDocument();
    expect(accountEntry.parentElement).toHaveClass('ml-auto', 'shrink-0');
    expect(screen.getByRole('banner').firstElementChild).toHaveClass('max-[767px]:px-4');
    expect(brandLink).not.toHaveAttribute('aria-label');
    expect(aboutLink.className).toContain('font-semibold');
    expect(aboutLink.className).not.toContain('font-extrabold');
    expect(aboutLink.className).toContain('hover:text-primary');
    expect(aboutLink.className).toContain('hover:after:scale-x-100');
    expect(aboutLink.className).toContain('after:inset-x-0');
    expect(aboutLink.className).toContain('after:bottom-0');
    expect(aboutLink.className).toContain('data-[active=true]:after:scale-x-100');
  });

  it('renders three mobile tabs and keeps account access in the header', async () => {
    const getSession = vi.fn().mockResolvedValue({authenticated: false});

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={{...anonymousSessionClient, getSession}} />
      </NextIntlClientProvider>
    );

    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});
    expect(mobileNavigation).toHaveClass('site-mobile-tab-bar');
    expect(mobileNavigation.querySelectorAll('a')).toHaveLength(3);
    expect(screen.queryByRole('button', {name: '開啟選單'})).not.toBeInTheDocument();
    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('lets long localized branding shrink before the fixed account slot at mobile zoom widths', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    const brandLink = screen.getByRole('link', {name: /哈利路亞家教會/});
    expect(brandLink).toHaveClass('max-[767px]:min-w-0', 'max-[767px]:flex-1');
    expect(screen.getByText('哈利路亞家教會')).toHaveClass('truncate');
    expect((await screen.findByRole('link', {name: '登入'})).parentElement).toHaveClass('shrink-0');
  });

  it('marks the mobile navigation only for an installed iPhone PWA', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)'
    }) as MediaQueryList));

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    await waitFor(() => expect(screen.getByRole('navigation', {name: '選單'})).toHaveAttribute('data-iphone-standalone', 'true'));
  });

  it('hides mobile chrome when scrolling down and restores it when scrolling up', () => {
    let scrollY = 0;
    let animationFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrame = callback;
      return 1;
    });

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    const header = screen.getByRole('banner');
    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});

    scrollY = 40;
    act(() => {
      fireEvent.scroll(window);
      animationFrame?.(0);
    });
    expect(header).toHaveAttribute('data-mobile-hidden', 'true');
    expect(mobileNavigation).toHaveAttribute('data-mobile-hidden', 'true');

    scrollY = 12;
    act(() => {
      fireEvent.scroll(window);
      animationFrame?.(0);
    });
    expect(header).toHaveAttribute('data-mobile-hidden', 'false');
    expect(mobileNavigation).toHaveAttribute('data-mobile-hidden', 'false');
  });

  it('does not repeat the English brand subtitle', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SiteHeader layout={{...layout, locale: 'en', siteName: 'Hallelujah Home Church'}} locale="en" pathname="/en" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(screen.getAllByText('Hallelujah Home Church')).toHaveLength(1);
  });

  it.each([
    ['ja', ja, 'メインナビゲーション'],
    ['ko', ko, '주요 메뉴']
  ] as const)('localizes the primary navigation name for %s', async (locale, messages, navigationName) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteHeader layout={{...layout, locale}} locale={locale} pathname={`/${locale}`} sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('navigation', {name: navigationName})).toBeInTheDocument();
    expect(await screen.findByRole('link', {name: messages.site.account.signIn})).toBeInTheDocument();
  });

  it('renders projected branding and visible navigation while retaining i18n navigation labels', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader
          layout={{
            ...layout,
            siteName: 'CMS 教會名稱',
            englishName: 'CMS English Name',
            header: [
              {key: 'about', label: 'CMS 關於', href: '/zh-Hant/about', visible: true},
              {key: 'news', label: 'CMS 隱藏消息', href: '/zh-Hant/news', visible: false},
              {key: 'literature-ministry', label: 'CMS 文字', href: '/zh-Hant/literature-ministry', visible: true}
            ]
          }}
          locale="zh-Hant"
          pathname="/zh-Hant/about"
          sessionClient={anonymousSessionClient}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('link', {name: /CMS 教會名稱/})).toHaveAttribute('href', '/zh-Hant');
    expect(screen.getAllByRole('link', {name: 'CMS 關於'})[0]).toHaveAttribute('href', '/zh-Hant/about');
    expect(screen.queryByRole('link', {name: 'CMS 隱藏消息'})).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: '主要導覽'})).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: '選單'})).toBeInTheDocument();
    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
  });
});
