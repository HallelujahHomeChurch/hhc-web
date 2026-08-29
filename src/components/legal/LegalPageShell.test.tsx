import type {SiteLayout} from '@/features/site-layout/types';
import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {describe, expect, it, vi} from 'vitest';
import zhHant from '@/i18n/locales/zh-Hant.json';

const getSiteLayout = vi.hoisted(() => vi.fn());
const getSharedAccountSessionClient = vi.hoisted(() => vi.fn(() => ({
  getSession: async () => ({authenticated: false}),
  issueAccessToken: async () => ({accessToken: '', expiresIn: 0}),
  logout: async () => undefined,
  logoutAll: async () => undefined
})));

vi.mock('@/features/site-layout/api', () => ({getSiteLayout}));
vi.mock('@/lib/browser-bootstrap', () => ({
  clearSharedAccountSession: vi.fn(),
  getSharedAccountSessionClient,
  getSharedPushConfig: vi.fn(),
  revalidateSharedAccountSession: vi.fn()
}));

import {LegalPageShell} from './LegalPageShell';

const layout: SiteLayout = {
  locale: 'zh-Hant',
  siteName: '哈利路亞家教會',
  englishName: 'Hallelujah Home Church',
  copyrightHolder: '社團法人中華民國哈利路亞社區關懷協會',
  allRightsReserved: 'All rights reserved.',
  seoTitleSuffix: '哈利路亞家教會',
  seoDescriptionFallback: '在愛中建造家庭，在真理中成長',
  header: [{key: 'about', label: '關於我們', href: '/zh-Hant/about', visible: true}],
  legal: [{key: 'privacy-policy', label: '隱私權', href: '/zh-Hant/privacy-policy', visible: true}],
  links: {churchYoutube: 'https://youtube.com', churchFacebook: 'https://facebook.com', musicYoutube: 'https://youtube.com'},
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
};

describe('LegalPageShell', () => {
  it('uses the public shell without either primary navigation', async () => {
    getSiteLayout.mockResolvedValue(layout);

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        {await LegalPageShell({children: <article>法律內容</article>, locale: 'zh-Hant', pathname: '/zh-Hant/privacy-policy'})}
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '主要導覽'})).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: '選單'})).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: '法律資訊'})).toBeInTheDocument();
    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /語言/})).toBeInTheDocument();
    expect(screen.getByText('法律內容')).toBeInTheDocument();
  });
});
