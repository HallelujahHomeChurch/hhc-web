import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {SiteLayout} from '@/features/site-layout/types';
import en from '@/i18n/locales/en.json';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {SiteHeader} from './SiteHeader';

const anonymousSessionClient: AccountSessionClient = {
  getSession: async () => ({authenticated: false}),
  issueAccessToken: async () => ({accessToken: '', expiresIn: 0}),
  logout: async () => undefined,
  logoutAll: async () => undefined
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

  it('renders Home first in the four-item mobile navigation and keeps account access in the header', async () => {
    const getSession = vi.fn().mockResolvedValue({authenticated: false});

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={{...anonymousSessionClient, getSession}} />
      </NextIntlClientProvider>
    );

    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});
    expect(mobileNavigation).toHaveClass('site-mobile-tab-bar');
    expect(within(mobileNavigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '首頁',
      '關於我們',
      '最新消息',
      '文字事工'
    ]);
    expect(screen.queryByRole('button', {name: '開啟選單'})).not.toBeInTheDocument();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('selects Home only on the locale root', async () => {
    const {rerender} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    await screen.findByRole('link', {name: '登入'});
    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});
    expect(within(mobileNavigation).getByRole('link', {name: '首頁'})).toHaveAttribute('aria-current', 'page');

    rerender(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(within(mobileNavigation).getByRole('link', {name: '首頁'})).not.toHaveAttribute('aria-current');
    expect(within(mobileNavigation).getByRole('link', {name: '關於我們'})).toHaveAttribute('aria-current', 'page');
  });

  it('starts moving the shared mobile indicator and replays only the latest rapid navigation', async () => {
    let nextFrame = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    });
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
    const {container} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    await screen.findByRole('link', {name: '登入'});
    const mobileNavigation = within(screen.getByRole('navigation', {name: '選單'}));
    const newsLink = mobileNavigation.getByRole('link', {name: '最新消息'});
    const aboutLink = mobileNavigation.getByRole('link', {name: '關於我們'});
    newsLink.addEventListener('click', (event) => event.preventDefault());
    aboutLink.addEventListener('click', (event) => event.preventDefault());
    const aboutClick = vi.spyOn(aboutLink, 'click');
    fireEvent.click(newsLink);

    expect(container.querySelector('[data-mobile-nav-indicator]')).toHaveStyle({transform: 'translate3d(200%, 0, 0)'});
    expect(newsLink).toHaveAttribute('data-active', 'true');
    act(() => frames.get(1)?.(0));
    fireEvent.click(aboutLink);

    expect(cancelFrame).toHaveBeenCalledWith(2);
    expect(container.querySelector('[data-mobile-nav-indicator]')).toHaveStyle({transform: 'translate3d(100%, 0, 0)'});
    act(() => frames.get(3)?.(16));
    act(() => frames.get(4)?.(32));
    expect(aboutClick).toHaveBeenCalledOnce();
    expect(mobileNavigation.getByRole('link', {name: '首頁'})).not.toHaveAttribute('data-active');
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

  it('sizes the mobile navigation from the visible projected items', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader
          layout={{...layout, header: layout.header.map((item) => ({...item, visible: item.key !== 'news'}))}}
          locale="zh-Hant"
          pathname="/zh-Hant/about"
          sessionClient={anonymousSessionClient}
        />
      </NextIntlClientProvider>
    );

    await screen.findByRole('link', {name: '登入'});
    expect(screen.getByRole('navigation', {name: '選單'})).toHaveStyle({
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    });
  });

  it('keeps Home in the mobile navigation when all projected items are hidden', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader
          layout={{...layout, header: layout.header.map((item) => ({...item, visible: false}))}}
          locale="zh-Hant"
          pathname="/zh-Hant"
          sessionClient={anonymousSessionClient}
        />
      </NextIntlClientProvider>
    );

    await screen.findByRole('link', {name: '登入'});
    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});
    expect(within(mobileNavigation).getAllByRole('link')).toHaveLength(1);
    expect(within(mobileNavigation).getByRole('link', {name: '首頁'})).toHaveAttribute('aria-current', 'page');
    expect(mobileNavigation).toHaveStyle({gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'});
  });

  it('keeps account access and branding while navigation is disabled', async () => {
    const authenticatedClient: AccountSessionClient = {
      ...anonymousSessionClient,
      getSession: async () => ({
        authenticated: true,
        user: {id: 'u1', email: 'member@example.com', display_name: '會員', avatar_url: null, admin_access: false}
      })
    };

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader
          layout={layout}
          locale="zh-Hant"
          pathname="/zh-Hant/privacy-policy"
          sessionClient={authenticatedClient}
          showNavigation={false}
        />
      </NextIntlClientProvider>
    );

    expect(screen.queryByRole('navigation', {name: '主要導覽'})).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '選單'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /哈利路亞家教會/})).toHaveAttribute('href', '/zh-Hant');
    expect(await screen.findByRole('button', {name: '帳號選單'})).toBeInTheDocument();
  });
});
