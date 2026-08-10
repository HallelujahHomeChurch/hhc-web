import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {AccountSessionClient} from '@hallelujahhomechurch/account-client';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {SiteHeader} from './SiteHeader';

const anonymousSessionClient: AccountSessionClient = {
  getSession: async () => ({authenticated: false}),
  logout: async () => undefined
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SiteHeader', () => {
  it('renders brand, navigation, and account entry point', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
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
    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
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
        <SiteHeader locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={{...anonymousSessionClient, getSession}} />
      </NextIntlClientProvider>
    );

    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});
    expect(mobileNavigation).toHaveClass('site-mobile-tab-bar');
    expect(mobileNavigation.querySelectorAll('a')).toHaveLength(3);
    expect(screen.queryByRole('button', {name: '開啟選單'})).not.toBeInTheDocument();
    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('marks the mobile navigation only for an installed iPhone PWA', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)'
    }) as MediaQueryList));

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
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
        <SiteHeader locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
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
        <SiteHeader locale="en" pathname="/en" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(screen.getAllByText('Hallelujah Home Church')).toHaveLength(1);
  });
});
