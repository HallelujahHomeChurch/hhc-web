import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {siteConfig} from '@/lib/site';
import {SiteFooter} from './SiteFooter';

describe('SiteFooter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders brand, custom language selector, notification control, and social links without footer navigation', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {register: vi.fn().mockResolvedValue({pushManager: {getSubscription: vi.fn().mockResolvedValue(null)}})}
    });
    Object.defineProperty(globalThis, 'PushManager', {configurable: true, value: class {}});
    Object.defineProperty(globalThis, 'Notification', {configurable: true, value: {permission: 'default'}});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({data: {vapidPublicKey: 'AQID'}}), {status: 200})
    ));

    const {container} = render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteFooter locale="zh-Hant" pathname="/zh-Hant/about" />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('哈利路亞家教會')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '關於我們'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /語言/})).toHaveTextContent('繁中');
    expect(container.querySelector('select')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('link', {name: 'YouTube'})).toHaveAttribute('href', siteConfig.social.youtube);
    expect(screen.getByRole('link', {name: 'Facebook'})).toHaveAttribute('href', siteConfig.social.facebook);
    const notification = await screen.findByRole('button', {name: '開啟通知'});
    expect(notification).toHaveClass('size-11', 'p-0', 'rounded-full');
    expect(notification).not.toHaveTextContent('開啟通知');
    expect(notification.parentElement).toHaveClass('gap-3');
    expect(screen.getByText(/社團法人中華民國哈利路亞社區關懷協會/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '隱私權'})).toHaveAttribute('href', '/zh-Hant/privacy-policy');
    expect(screen.getByRole('link', {name: '條款'})).toHaveAttribute('href', '/zh-Hant/terms-of-use');
  });
});
