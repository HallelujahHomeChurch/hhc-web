import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NextIntlClientProvider} from 'next-intl';
import {describe, expect, it} from 'vitest';
import type {AccountSessionClient} from '@hhc/account-client';
import en from '@/i18n/locales/en.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {SiteHeader} from './SiteHeader';

const anonymousSessionClient: AccountSessionClient = {
  getSession: async () => ({authenticated: false}),
  logout: async () => undefined
};

describe('SiteHeader', () => {
  it('renders brand, navigation, and account entry point', async () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('哈利路亞家教會')).toBeInTheDocument();
    const aboutLink = screen.getByRole('link', {name: '關於我們'});
    const literatureMinistryLink = screen.getByRole('link', {name: '文字事工'});

    expect(aboutLink).toHaveAttribute('href', '/zh-Hant/about');
    expect(literatureMinistryLink).toHaveAttribute('href', '/zh-Hant/literature-ministry');
    expect(aboutLink).toHaveAttribute('aria-current', 'page');
    expect(aboutLink).toHaveAttribute('data-active', 'true');
    expect(await screen.findByRole('link', {name: '登入'})).toBeInTheDocument();
    expect(aboutLink.className).toContain('font-semibold');
    expect(aboutLink.className).not.toContain('font-extrabold');
    expect(aboutLink.className).toContain('hover:text-primary');
    expect(aboutLink.className).toContain('hover:after:scale-x-100');
    expect(aboutLink.className).toContain('after:inset-x-0');
    expect(aboutLink.className).toContain('after:bottom-0');
    expect(aboutLink.className).toContain('data-[active=true]:after:scale-x-100');
    expect(aboutLink.className).toContain('max-[620px]:after:hidden');
  });

  it('toggles the mobile navigation menu', async () => {
    const user = userEvent.setup();

    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteHeader locale="zh-Hant" pathname="/zh-Hant/about" sessionClient={anonymousSessionClient} />
      </NextIntlClientProvider>
    );

    const button = screen.getByRole('button', {name: '開啟選單'});

    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
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
