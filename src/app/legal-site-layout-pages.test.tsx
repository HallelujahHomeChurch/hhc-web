import type {SiteLayout} from '@/features/site-layout/types';
import {render, screen, within} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import zhHant from '@/i18n/locales/zh-Hant.json';

const getSiteLayout = vi.hoisted(() => vi.fn());
const getLegalPage = vi.hoisted(() => vi.fn());
const getSharedAccountSessionClient = vi.hoisted(() => vi.fn(() => ({
  getSession: async () => ({authenticated: false}),
  issueAccessToken: async () => ({accessToken: '', expiresIn: 0}),
  logout: async () => undefined,
  logoutAll: async () => undefined
})));
vi.mock('@/features/site-layout/api', () => ({getSiteLayout}));
vi.mock('@/features/pages/api', () => ({getLegalPage}));
vi.mock('@/lib/browser-bootstrap', () => ({
  clearSharedAccountSession: vi.fn(),
  getSharedAccountSessionClient,
  getSharedPushConfig: vi.fn(),
  revalidateSharedAccountSession: vi.fn()
}));
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('next/navigation', () => ({notFound: vi.fn()}));

import MaintenancePage from './[locale]/maintenance/page';
import UnsubscribePage from './[locale]/newsletter/unsubscribe/page';
import PrivacyPolicyPage from './[locale]/privacy-policy/page';
import TermsOfUsePage from './[locale]/terms-of-use/page';

const layout: SiteLayout = {
  locale: 'zh-Hant',
  siteName: 'CMS 法律站名',
  englishName: 'CMS Legal Site',
  copyrightHolder: 'CMS 著作權人',
  allRightsReserved: 'CMS 保留權利',
  seoTitleSuffix: 'CMS 法律 SEO',
  seoDescriptionFallback: 'CMS 法律說明',
  header: [],
  legal: [],
  links: {
    churchYoutube: 'https://youtube.com/@cms-church',
    churchFacebook: 'https://www.facebook.com/cms-church',
    musicYoutube: 'https://youtube.com/@cms-music'
  },
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
};

describe('standalone legal page site layout', () => {
  it.each([
    ['maintenance', () => MaintenancePage({params: Promise.resolve({locale: 'zh-Hant'})})],
    ['unsubscribe', () => UnsubscribePage({params: Promise.resolve({locale: 'zh-Hant'}), searchParams: Promise.resolve({token: 'abc'})})],
    ['privacy', () => PrivacyPolicyPage({params: Promise.resolve({locale: 'zh-Hant'})})],
    ['terms', () => TermsOfUsePage({params: Promise.resolve({locale: 'zh-Hant'})})]
  ] as const)('renders the projected site name on %s', async (_name, page) => {
    getSiteLayout.mockResolvedValue(layout);
    getLegalPage.mockImplementation((key: 'privacy-policy' | 'terms-of-use') => Promise.resolve(legalPage(key)));
    renderLegalPage(await page());

    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByRole('link', {name: /CMS 法律站名/})).toHaveAttribute('href', '/zh-Hant');
    expect(getSiteLayout).toHaveBeenCalledWith('zh-Hant');
  });

  it.each([
    ['privacy-policy', () => PrivacyPolicyPage({params: Promise.resolve({locale: 'zh-Hant'})})],
    ['terms-of-use', () => TermsOfUsePage({params: Promise.resolve({locale: 'zh-Hant'})})]
  ] as const)('renders %s through the existing LegalDocument component', async (key, page) => {
    getSiteLayout.mockResolvedValue(layout);
    getLegalPage.mockResolvedValue(legalPage(key));
    renderLegalPage(await page());

    expect(screen.getByRole('heading', {level: 1, name: `CMS ${key}`})).toBeInTheDocument();
    expect(screen.getByText(`CMS ${key} paragraph`)).toBeInTheDocument();
  });
});

function renderLegalPage(page: ReactNode) {
  return render(
    <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
      {page}
    </NextIntlClientProvider>
  );
}

function legalPage(key: 'privacy-policy' | 'terms-of-use') {
  return {source: 'cms', indexable: true, availableLocales: ['zh-Hant', 'en'], content: {
    heroTitle: `CMS ${key}`, heroSubtitle: `CMS ${key} summary`, updatedAtLabel: 'CMS updated', updatedAt: '2026-08-29',
    intro: `CMS ${key} intro`, sections: [{title: `CMS ${key} section`, body: [`CMS ${key} paragraph`]}]
  }};
}
