import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createNavigationPresentation, type AccountSessionClient} from '@hallelujahhomechurch/account-client';
import type {SiteLayout} from '@/features/site-layout/types';
import en from '@/i18n/locales/en.json';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {AccountControlProvider, BulletinAccessGate, useAccountAuth} from './AccountControl';
import {SiteHeader} from './SiteHeader';
import {InitialLoadingBoundary} from './InitialLoadingBoundary';

const searchRouter = vi.hoisted(() => ({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>searchRouter}));

const statementStripState = vi.hoisted(() => ({active: false, notice: false}));

vi.mock('@/components/statements/StatementProvider', () => ({
  useStatement: () => statementStripState.notice ? {
    statement: {href: '/zh-Hant/statements/current', resolvedLocale: 'zh-Hant', title: '最新聲明'},
    labels: {readFull: '閱讀全文'}
  } : null
}));

vi.mock('@/components/statements/StatementStrip', () => ({
  StatementStrip: () => statementStripState.active ? <aside aria-label="Statement notice">Statement</aside> : null
}));

const anonymousSessionClient: AccountSessionClient = {
  getSession: async () => ({authenticated: false}),
  issueAccessToken: async () => ({accessToken: '', expiresIn: 0}),
  refreshAccessToken: async () => ({accessToken: '', expiresIn: 0}),
  logout: async () => undefined,
  logoutAll: async () => undefined
};

const accountLabels = {
  menu: '帳號選單',
  projectionSystem: '投影系統', projectionWindowLabel: '另開視窗', projectionPopupBlocked: '瀏覽器阻擋開啟視窗。',
  adminManagement: '後台管理',
  organizationManagement: '小家管理',
  manageAccount: '管理帳號',
  signIn: '登入',
  signOut: '登出',
  signOutError: '登出失敗',
  unsyncedWarning: '尚有未同步的變更，是否繼續？'
};

const layout: SiteLayout = {
  locale: 'zh-Hant',
  siteName: '哈利路亞家教會',
  englishName: 'Hallelujah Home Church',
  copyrightHolder: '哈利路亞家教會',
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

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

afterEach(() => {
  statementStripState.active = false;
  statementStripState.notice = false;
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('SiteHeader', () => {
  it.each([
    ['/zh-Hant/member-videos','/zh-Hant','首頁'],
    ['/zh-Hant/member-videos/','/zh-Hant','首頁'],
    ['/zh-Hant/member-videos/r1','/zh-Hant/member-videos','影音專區'],
    ['/zh-Hant/member-videos-other','/zh-Hant','首頁'],
    ['/zh-Hant/news','/zh-Hant','首頁']
  ])('routes the brand from %s to %s',(pathname,href,label)=>{
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}><SiteHeader layout={layout} locale="zh-Hant" pathname={pathname} sessionClient={anonymousSessionClient}/></NextIntlClientProvider>);
    const brand=screen.getByRole('link',{name:/哈利路亞家教會/});
    expect(brand).toHaveAttribute('href',href);
    expect(brand).toHaveAttribute('aria-label',`${label} · 哈利路亞家教會`);
    expect(screen.queryByRole('link',{name:'首頁'})).not.toBeInTheDocument();
  });

  it('keeps video search available on the video route before qualification resolves', async () => {
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}><SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/member-videos" sessionClient={anonymousSessionClient} /></NextIntlClientProvider>);
    const search = screen.getByRole('button', {name: '搜尋影片'});
    fireEvent.click(search);
    const input = await screen.findByRole('searchbox', {name: '搜尋影片'});
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, {target: {value: '主日'}});
    fireEvent.click(screen.getByRole('button', {name: '關閉搜尋'}));
    expect(search).toHaveFocus();
    fireEvent.click(search);
    expect(input).toHaveValue('主日');
  });

  it('reserves center navigation only when the expanded field cannot fit beside it', async () => {
    let width = 1024;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const bounds = this.classList.contains('site-header-row') ? [0, width] : this.classList.contains('site-header-brand') ? [24, 240] : this.classList.contains('site-header-account') ? [width - 64, width - 24] : this.id === 'site-navigation' ? [width / 2 - 220, width / 2 + 220] : [0, 0];
      return {x: bounds[0], y: 0, left: bounds[0], right: bounds[1], top: 0, bottom: 76, width: bounds[1] - bounds[0], height: 76, toJSON: () => ({})};
    });
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}><SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/member-videos" sessionClient={anonymousSessionClient} /></NextIntlClientProvider>);
    const header = screen.getByRole('banner');
    await waitFor(() => expect(header).toHaveAttribute('data-search-replaces-nav', 'true'));
    fireEvent.click(screen.getByRole('button', {name: '搜尋影片'}));
    expect(header).toHaveAttribute('data-search-open', 'true');
    width = 1920;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(header).toHaveAttribute('data-search-replaces-nav', 'false'));
    fireEvent.click(screen.getByRole('button', {name: '關閉搜尋'}));
    expect(header).toHaveAttribute('data-search-open', 'false');
  });

  it('restores both navigation bars before session resolves without opening protected content, then removes revoked access', async () => {
    const cached = createNavigationPresentation({key: 'hhc:navigation:www-web', allowedIds: ['account', 'admin', 'literature-ministry', 'member-videos']});
    cached.identify('u1');
    cached.capture('u1')('account', ['account', 'admin']);
    cached.capture('u1')('operations', ['literature-ministry', 'member-videos']);
    let resolveSession!: (value: Awaited<ReturnType<AccountSessionClient['getSession']>>) => void;
    const client: AccountSessionClient = {...anonymousSessionClient, getSession: vi.fn(() => new Promise<Awaited<ReturnType<AccountSessionClient['getSession']>>>(resolve => {resolveSession = resolve;})), issueAccessToken: vi.fn(async () => ({accessToken: 'token', expiresIn: 900}))};
    const fetcher = vi.fn(async () => Response.json({memberships: [], orgRoles: [], responsibilities: [], entitlements: [], version: 'revoked'}));
    vi.stubGlobal('fetch', fetcher);
    function Status() { return <output>{useAccountAuth().status}</output>; }
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <AccountControlProvider client={client} labels={accountLabels}>
        <InitialLoadingBoundary label="Restoring"><SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" /></InitialLoadingBoundary>
        <Status /><BulletinAccessGate><span>Private bulletin</span></BulletinAccessGate>
      </AccountControlProvider>
    </NextIntlClientProvider>);
    expect(screen.getAllByRole('link', {name: '文字事工'})).toHaveLength(2);
    expect(screen.queryByText('Restoring')).not.toBeInTheDocument();
    expect(screen.getByText('checking')).toBeInTheDocument();
    expect(screen.queryByText('Private bulletin')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(client.issueAccessToken).not.toHaveBeenCalled();
    await act(async () => resolveSession({authenticated: true, user: {id: 'u1', email: 'member@example.test', display_name: 'Member', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}}));
    await waitFor(() => expect(screen.queryByRole('link', {name: '文字事工'})).not.toBeInTheDocument());
    expect(screen.queryByText('Private bulletin')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('hhc:navigation:www-web')!).sources.operations.ids).toEqual([]);
  });

  it('shows the LINE notice instead of the statement strip and restores the strip on dismissal', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0');
    statementStripState.active = true;
    window.history.replaceState({}, '', '/zh-Hant/news?source=line#article');
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/news" sessionClient={anonymousSessionClient} />
    </NextIntlClientProvider>);

    const notice = await screen.findByRole('complementary', {name: '瀏覽器開啟提示'});
    expect(screen.queryByRole('complementary', {name: 'Statement notice'})).not.toBeInTheDocument();
    expect(within(notice).getByRole('link', {name: '開啟預設瀏覽器'})).toHaveAttribute('href', 'http://localhost:3000/zh-Hant/news?source=line&openExternalBrowser=1#article');
    fireEvent.click(within(notice).getByRole('button', {name: '關閉瀏覽器提示並留在此頁'}));
    expect(screen.getByRole('complementary', {name: 'Statement notice'})).toBeInTheDocument();
  });

  it('follows the statement suppression rule on legal pages', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0');
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/privacy-policy" sessionClient={anonymousSessionClient} />
    </NextIntlClientProvider>);
    expect(screen.queryByRole('complementary', {name: '瀏覽器開啟提示'})).not.toBeInTheDocument();
  });

  it('keeps an active statement link inside the LINE notice except on statement detail pages', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0');
    statementStripState.notice = true;
    const {rerender} = render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/news" sessionClient={anonymousSessionClient} />
    </NextIntlClientProvider>);

    const notice = await screen.findByRole('complementary', {name: '瀏覽器開啟提示'});
    expect(within(notice).getByRole('link', {name: '最新聲明 · 閱讀全文 →'})).toHaveAttribute('href', '/zh-Hant/statements/current');
    rerender(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/statements/current" sessionClient={anonymousSessionClient} />
    </NextIntlClientProvider>);
    expect(within(notice).queryByRole('link', {name: '最新聲明 · 閱讀全文 →'})).not.toBeInTheDocument();
  });
  it('keeps the banner and active statement in one top chrome wrapper', () => {
    statementStripState.active = true;
    const {container} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    const topChrome = container.querySelector('.site-top-chrome');
    expect(topChrome).toContainElement(screen.getByRole('banner'));
    expect(topChrome).toContainElement(screen.getByRole('complementary', {name: 'Statement notice'}));
  });

  it('keeps the top chrome wrapper without reserving an empty statement strip', () => {
    const {container} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    const topChrome = container.querySelector('.site-top-chrome');
    expect(topChrome).toContainElement(screen.getByRole('banner'));
    expect(topChrome?.querySelector('aside')).toBeNull();
  });

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

    expect(aboutLink).toHaveAttribute('href', '/zh-Hant/about');
    expect(newsLinks[0]).toHaveAttribute('href', '/zh-Hant/news');
    expect(within(desktopNavigation).queryByRole('link', {name: '文字事工'})).not.toBeInTheDocument();
    expect(aboutLink).toHaveAttribute('aria-current', 'page');
    expect(aboutLink).toHaveAttribute('data-active', 'true');
    const accountEntry = await screen.findByRole('link', {name: '登入'});
    expect(accountEntry).toBeInTheDocument();
    expect(accountEntry.parentElement).toHaveClass('site-header-account');
    expect(screen.getByRole('banner').firstElementChild).toHaveClass('max-[767px]:px-4');
    expect(brandLink).toHaveAttribute('aria-label', '首頁 · 哈利路亞家教會');
    expect(aboutLink.className).toContain('font-semibold');
    expect(aboutLink.className).not.toContain('font-extrabold');
    expect(aboutLink.className).toContain('hover:text-primary');
    expect(aboutLink.className).toContain('hover:after:scale-x-100');
    expect(aboutLink.className).toContain('after:inset-x-0');
    expect(aboutLink.className).toContain('after:bottom-0');
    expect(aboutLink.className).toContain('data-[active=true]:after:scale-x-100');
  });

  it('keeps two public destinations and the account last for anonymous visitors', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED', 'true');
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
      '最新消息',
      '關於我們',
      ''
    ]);
    expect(screen.queryByRole('button', {name: '開啟選單'})).not.toBeInTheDocument();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it.each([true, false])('gates enabled video navigation on the independent viewing entitlement: %s', async (allowed) => {
    vi.stubEnv('NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({
      memberships: [], orgRoles: [], qualifications: [], version: 'a'.repeat(64),
      entitlements: allowed ? [{assignmentId: 'e1', entitlementCode: 'video.meeting-recordings.access', validFrom: '2026-09-17T00:00:00Z'}] : []
    })));
    const client: AccountSessionClient = {...anonymousSessionClient,
      getSession: async () => ({authenticated: true, user: {id: 'u1', email: 'member@example.com', display_name: '會員', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}}),
      issueAccessToken: async () => ({accessToken: 'test-token', expiresIn: 300})
    };
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <AccountControlProvider client={client} labels={accountLabels}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" />
      </AccountControlProvider>
    </NextIntlClientProvider>);
    await screen.findByRole('button', {name: '帳號選單'});
    if (allowed) await waitFor(() => expect(screen.getAllByRole('link', {name: '影音專區'})).toHaveLength(2));
    else expect(screen.queryByRole('link', {name: '影音專區'})).not.toBeInTheDocument();
  });

  it('replaces public mobile destinations with entitled content while keeping account last', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({memberships: [], orgRoles: [], qualifications: [], version: 'a'.repeat(64), entitlements: [
      {assignmentId: 'e1', entitlementCode: 'video.meeting-recordings.access', validFrom: '2026-09-17T00:00:00Z'},
      {assignmentId: 'e2', entitlementCode: 'bulletin.general.zh-Hant.access', validFrom: '2026-09-17T00:00:00Z'}
    ]})));
    const client: AccountSessionClient = {...anonymousSessionClient, getSession: async () => ({authenticated: true, user: {id: 'u1', email: 'member@example.test', display_name: 'Member', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}}), issueAccessToken: async () => ({accessToken: 'test-token', expiresIn: 900})};
    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}><SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={client} /></NextIntlClientProvider>);
    const mobile = screen.getByRole('navigation', {name: '選單'});
    await within(mobile).findByRole('button', {name: '我的'});
    await waitFor(() => expect(within(mobile).getAllByRole('link').map(link => link.textContent)).toEqual(['文字事工', '影音專區']));
    expect(within(mobile).queryByRole('link', {name: '最新消息'})).not.toBeInTheDocument();
    expect(within(mobile).queryByRole('link', {name: '關於我們'})).not.toBeInTheDocument();
    expect(mobile.lastElementChild).toContainElement(within(mobile).getByRole('button', {name: '我的'}));
    expect(mobile).toHaveStyle({gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'});
    expect(within(screen.getByRole('navigation', {name: '主要導覽'})).getByRole('link', {name: '最新消息'})).toBeInTheDocument();
  });

  it('hides the member video link in desktop and mobile navigation by default', () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(within(screen.getByRole('navigation', {name: '主要導覽'})).queryByRole('link', {name: '影音專區'})).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', {name: '選單'})).queryByRole('link', {name: '影音專區'})).not.toBeInTheDocument();
  });

  it('does not enable the member video link for a false build setting', () => {
    vi.stubEnv('NEXT_PUBLIC_MEMBER_VIDEO_NAV_ENABLED', 'false');
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(screen.queryByRole('link', {name: '影音專區'})).not.toBeInTheDocument();
  });

  it('keeps the account item visible when a route replaces the header', async () => {
    const getSession = vi.fn()
      .mockResolvedValueOnce({authenticated: false})
      .mockImplementation(() => new Promise(() => undefined));
    const routeSessionClient = {...anonymousSessionClient, getSession};
    const {rerender} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <AccountControlProvider client={anonymousSessionClient} labels={accountLabels}>
          <SiteHeader key="home" layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={routeSessionClient} />
        </AccountControlProvider>
      </NextIntlClientProvider>
    );

    await screen.findByRole('link', {name: '登入'});
    rerender(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <AccountControlProvider client={anonymousSessionClient} labels={accountLabels}>
          <SiteHeader key="about" layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={routeSessionClient} />
        </AccountControlProvider>
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('link', {name: '登入'})).toBeInTheDocument();
  });

  it('does not select a bottom destination on the locale root', async () => {
    const {rerender} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    await screen.findByRole('link', {name: '登入'});
    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});
    expect(within(mobileNavigation).getByRole('link', {name: '我的'})).toHaveAttribute('href', expect.stringContaining('/login'));
    expect(within(mobileNavigation).queryByRole('link', {name: '首頁'})).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(within(mobileNavigation).queryByRole('link', {name: '首頁'})).not.toBeInTheDocument();
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

    expect(container.querySelector('[data-mobile-nav-indicator]')).toHaveStyle({transform: 'translate3d(0%, 0, 0)'});
    expect(newsLink).toHaveAttribute('data-active', 'true');
    act(() => frames.get(1)?.(0));
    fireEvent.click(aboutLink);

    expect(cancelFrame).toHaveBeenCalledWith(2);
    expect(container.querySelector('[data-mobile-nav-indicator]')).toHaveStyle({transform: 'translate3d(100%, 0, 0)'});
    act(() => frames.get(3)?.(16));
    act(() => frames.get(4)?.(32));
    expect(aboutClick).toHaveBeenCalledOnce();
    expect(newsLink).not.toHaveAttribute('data-active');
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

    await waitFor(() => {
      expect(screen.getByRole('banner')).toHaveAttribute('data-iphone-standalone', 'true');
      expect(screen.getByRole('navigation', {name: '選單'})).toHaveAttribute('data-iphone-standalone', 'true');
    });
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
    const topChrome = header.parentElement;
    const mobileNavigation = screen.getByRole('navigation', {name: '選單'});

    expect(topChrome).toHaveClass('site-top-chrome');

    scrollY = 40;
    act(() => {
      fireEvent.scroll(window);
      animationFrame?.(0);
    });
    expect(topChrome).toHaveAttribute('data-mobile-hidden', 'true');
    expect(header).not.toHaveAttribute('data-mobile-hidden');
    expect(mobileNavigation).toHaveAttribute('data-mobile-hidden', 'true');

    scrollY = 12;
    act(() => {
      fireEvent.scroll(window);
      animationFrame?.(0);
    });
    expect(topChrome).toHaveAttribute('data-mobile-hidden', 'false');
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
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    });
  });

  it('keeps the account last when all projected items are hidden', async () => {
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
    expect(within(mobileNavigation).getByRole('link', {name: '我的'})).toHaveAttribute('href', expect.stringContaining('/login'));
    expect(within(mobileNavigation).queryByRole('link', {name: '首頁'})).not.toBeInTheDocument();
    expect(mobileNavigation).toHaveStyle({gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'});
  });

  it('keeps account access and branding while navigation is disabled', async () => {
    const authenticatedClient: AccountSessionClient = {
      ...anonymousSessionClient,
      getSession: async () => ({
        authenticated: true,
        user: {id: 'u1', email: 'member@example.com', display_name: '會員', avatar_url: null},
        permissions: [],
        permission_availability: {status: 'available'}
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

  it('keeps LINE dismissal after a page remount when session storage is unavailable', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });
    const first = render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/news" sessionClient={anonymousSessionClient} />
    </NextIntlClientProvider>);
    const notice = await screen.findByRole('complementary', {name: '瀏覽器開啟提示'});
    fireEvent.click(within(notice).getByRole('button', {name: '關閉瀏覽器提示並留在此頁'}));
    first.unmount();

    render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      <SiteHeader layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
    </NextIntlClientProvider>);
    expect(screen.queryByRole('complementary', {name: '瀏覽器開啟提示'})).not.toBeInTheDocument();
  });
});

it.each(['/zh-Hant','/zh-Hant/news','/zh-Hant/member-videos-other'])('shows a disabled search on other routes: %s',pathname=>{
 render(<NextIntlClientProvider locale="zh-Hant" messages={zhHant}><SiteHeader layout={layout} locale="zh-Hant" pathname={pathname} sessionClient={anonymousSessionClient}/></NextIntlClientProvider>);
 expect(screen.getByRole('button',{name:'搜尋（尚未開放）'})).toBeDisabled();
});
