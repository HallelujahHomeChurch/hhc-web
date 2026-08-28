import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {SiteLayout} from '@hallelujahhomechurch/hhc-web-client';
import ja from '@/i18n/locales/ja.json';
import ko from '@/i18n/locales/ko.json';
import zhHant from '@/i18n/locales/zh-Hant.json';
import {SiteFooter} from './SiteFooter';

const layout: SiteLayout = {
  locale: 'zh-Hant',
  siteName: '哈利路亞家教會',
  englishName: 'Hallelujah Home Church',
  copyrightHolder: '社團法人中華民國哈利路亞社區關懷協會',
  allRightsReserved: 'All rights reserved.',
  seoTitleSuffix: '哈利路亞家教會',
  seoDescriptionFallback: '在愛中建造家庭，在真理中成長',
  header: [],
  legal: [
    {key: 'privacy-policy', label: '隱私權', href: '/zh-Hant/privacy-policy', visible: true},
    {key: 'terms-of-use', label: '條款', href: '/zh-Hant/terms-of-use', visible: true}
  ],
  links: {
    churchYoutube: 'https://youtube.com/@projected-church',
    churchFacebook: 'https://www.facebook.com/projected-church',
    musicYoutube: 'https://youtube.com/@projected-music'
  },
  version: 6,
  publishedAt: '2026-08-28T18:13:22.234929Z'
};

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
        <SiteFooter layout={layout} locale="zh-Hant" pathname="/zh-Hant/about" />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('哈利路亞家教會')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: '關於我們'})).not.toBeInTheDocument();
    const languageTrigger = screen.getByRole('button', {name: /語言/});
    expect(languageTrigger).toHaveTextContent('繁中');
    expect(languageTrigger).toHaveClass('hhc-select__trigger--utility');
    expect(languageTrigger).not.toHaveClass('site-language-trigger', 'legal-language-trigger');
    expect(languageTrigger).toHaveAccessibleName(/繁體中文/);
    expect(container.querySelector('select')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('link', {name: 'YouTube'})).toHaveAttribute('href', layout.links.churchYoutube);
    expect(screen.getByRole('link', {name: 'Facebook'})).toHaveAttribute('href', layout.links.churchFacebook);
    const notification = await screen.findByRole('button', {name: '開啟通知'});
    expect(notification).toHaveClass('hhc-icon-button', 'hhc-button--soft', 'hhc-button--lg');
    expect(notification).not.toHaveTextContent('開啟通知');
    const preferences = container.querySelector('.footer-preference-controls');
    const social = container.querySelector('.footer-social-controls');
    const controls = container.querySelector('.footer-control-row');
    expect(preferences).toContainElement(notification);
    expect(preferences).toHaveClass('gap-3');
    expect(social).toContainElement(screen.getByRole('link', {name: 'YouTube'}));
    expect(social).toContainElement(screen.getByRole('link', {name: 'Facebook'}));
    expect(social).toHaveClass('gap-3');
    expect(controls).toHaveClass('max-[620px]:justify-between');
    expect(controls?.parentElement).toHaveClass('max-[620px]:flex-col', 'max-[620px]:items-start');
    expect(screen.getByText(/社團法人中華民國哈利路亞社區關懷協會/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '隱私權'})).toHaveAttribute('href', '/zh-Hant/privacy-policy');
    expect(screen.getByRole('link', {name: '條款'})).toHaveAttribute('href', '/zh-Hant/terms-of-use');
  });

  it.each([
    ['ja', ja, 'ソーシャルメディア'],
    ['ko', ko, '소셜 미디어']
  ] as const)('localizes the social group name for %s', (locale, messages, groupName) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteFooter layout={{...layout, locale}} locale={locale} pathname={`/${locale}/about`} />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('group', {name: groupName})).toBeInTheDocument();
  });

  it('renders projected footer values and omits hidden legal items while retaining i18n control labels', () => {
    render(
      <NextIntlClientProvider locale="zh-Hant" messages={zhHant}>
        <SiteFooter
          layout={{
            ...layout,
            siteName: 'CMS 教會名稱',
            englishName: 'CMS English Name',
            copyrightHolder: 'CMS 著作權者',
            allRightsReserved: 'CMS 權利聲明',
            legal: [
              {key: 'privacy-policy', label: 'CMS 隱私', href: '/zh-Hant/privacy-policy', visible: true},
              {key: 'terms-of-use', label: 'CMS 隱藏條款', href: '/zh-Hant/terms-of-use', visible: false}
            ]
          }}
          locale="zh-Hant"
          pathname="/zh-Hant/about"
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('CMS 教會名稱')).toBeInTheDocument();
    expect(screen.getByText(/CMS 著作權者.*CMS 權利聲明/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'CMS 隱私'})).toHaveAttribute('href', '/zh-Hant/privacy-policy');
    expect(screen.queryByRole('link', {name: 'CMS 隱藏條款'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /語言/})).toBeInTheDocument();
    expect(screen.getByRole('group', {name: '社群'})).toBeInTheDocument();
  });
});
