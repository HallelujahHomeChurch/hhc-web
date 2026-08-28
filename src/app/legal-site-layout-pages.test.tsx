import type {SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

const getSiteLayout = vi.hoisted(() => vi.fn());
vi.mock('@/features/site-layout/api', () => ({getSiteLayout}));
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
    render(await page());

    expect(screen.getByRole('link', {name: 'CMS 法律站名'})).toHaveAttribute('href', '/zh-Hant');
    expect(getSiteLayout).toHaveBeenCalledWith('zh-Hant');
  });
});
