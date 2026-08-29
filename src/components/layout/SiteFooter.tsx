'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useTranslations} from 'next-intl';
import type {SiteLayout} from '@/features/site-layout/types';
import type {Locale} from '@/i18n/locales';
import {Button} from '@/components/ui/Button';
import {LanguageSwitcher} from './LanguageSwitcher';
import {WebPushControl} from './WebPushControl';

export type SiteFooterProps = {
  layout: SiteLayout;
  locale: Locale;
  pathname: string;
};

export function SiteFooter({layout, locale, pathname}: SiteFooterProps) {
  const t = useTranslations('site');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-[var(--hhc-footer)]">
      <div className="shell grid gap-5 py-6">
        <div className="flex items-center justify-between gap-6 max-[620px]:flex-col max-[620px]:items-start">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center" aria-hidden="true">
              <Image src="/assets/brand/logo.png" alt="" width={36} height={36} className="h-full w-full object-contain" />
            </span>
            <span className="grid gap-0.5 leading-none">
              <strong className="text-[17px] font-medium text-[var(--hhc-brand-ui)]">{layout.siteName}</strong>
              {locale !== 'en' ? <small className="text-[8px] font-extrabold uppercase text-[var(--hhc-brand-muted)]">{layout.englishName}</small> : null}
            </span>
          </Link>
          <div className="footer-control-row flex items-center gap-6 max-[620px]:w-full max-[620px]:justify-between">
            <div className="footer-preference-controls flex items-center gap-3">
              <LanguageSwitcher locale={locale} pathname={pathname} label={t('language')} />
              <WebPushControl
                locale={locale}
                autoPrompt={pathname === `/${locale}`}
                labels={{
                  enable: t('notifications.enable'),
                  disable: t('notifications.disable'),
                  pending: t('notifications.pending'),
                  denied: t('notifications.denied'),
                  error: t('notifications.error'),
                  promptTitle: t('notifications.promptTitle'),
                  promptBody: t('notifications.promptBody'),
                  promptAction: t('notifications.promptAction'),
                  promptLater: t('notifications.promptLater'),
                  promptDismiss: t('notifications.promptDismiss'),
                  installPrompt: t('notifications.installPrompt')
                }}
              />
            </div>
            <div className="footer-social-controls flex items-center gap-3" role="group" aria-label={t('social.navigation')}>
              <Button href={layout.links.churchYoutube} ariaLabel={t('social.youtube')} size="icon" target="_blank" variant="primarySoft">
                <svg viewBox="0 0 24 24" className="size-5 text-primary" aria-hidden="true">
                  <rect x="3" y="6.5" width="18" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
                </svg>
              </Button>
              <Button href={layout.links.churchFacebook} ariaLabel={t('social.facebook')} size="icon" target="_blank" variant="primarySoft">
                <span className="text-xl font-black leading-none text-primary" aria-hidden="true">f</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line pt-4 text-xs font-medium text-muted max-[620px]:flex-col max-[620px]:items-start">
          <p>© {year} {layout.copyrightHolder}. {layout.allRightsReserved}</p>
          <nav className="flex gap-4" aria-label={t('legalNavigation')}>
            {layout.legal.filter(({visible}) => visible).map((item) => (
              <Link key={item.key} href={item.href} className="hover:text-primary">{item.label}</Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
