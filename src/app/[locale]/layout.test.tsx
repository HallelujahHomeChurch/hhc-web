import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {AccountControlView} from '@/components/layout/AccountControl';
import LocaleLayout, {generateStaticParams} from './layout';

vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}));
vi.mock('@/lib/browser-bootstrap', () => ({
  clearSharedAccountSession: vi.fn(),
  getSharedAccountSessionClient: () => ({
    getSession: async () => ({authenticated: false}),
    issueAccessToken: async () => ({accessToken: '', expiresIn: 0}),
    logout: async () => undefined,
    logoutAll: async () => undefined
  }),
  revalidateSharedAccountSession: vi.fn()
}));

describe('LocaleLayout', () => {
  it('generates every product locale in canonical order', () => {
    expect(generateStaticParams()).toEqual([
      {locale: 'zh-Hant'},
      {locale: 'zh-Hans'},
      {locale: 'en'},
      {locale: 'ja'},
      {locale: 'ko'}
    ]);
  });

  it('marks localized content with its actual language', async () => {
    for (const locale of ['ja', 'ko']) {
      const layout = await LocaleLayout({
        children: <main />,
        params: Promise.resolve({locale})
      });
      const {container, unmount} = render(layout);
      expect(container.querySelector(`[data-locale="${locale}"]`)).toHaveAttribute('lang', locale);
      unmount();
    }
  });

  it('provides persistent account state to localized page content', async () => {
    render(await LocaleLayout({
      children: <AccountControlView />,
      params: Promise.resolve({locale: 'zh-Hant'})
    }));

    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
  });

  it('does not add a global loading page', () => {
    expect(existsSync(join(process.cwd(), 'src/app/loading.tsx'))).toBe(false);
  });
});
