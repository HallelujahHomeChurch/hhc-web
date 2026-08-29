import type {ReactNode} from 'react';
import type {Locale} from '@/i18n/locales';
import {getSiteLayout} from '@/features/site-layout/api';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {SiteHeader} from '@/components/layout/SiteHeader';

type LegalPageShellProps = {
  children: ReactNode;
  locale: Locale;
  pathname: string;
};

export async function LegalPageShell({children, locale, pathname}: LegalPageShellProps) {
  const layout = await getSiteLayout(locale);

  return (
    <div className="legal-page-shell">
      <SiteHeader layout={layout} locale={locale} pathname={pathname} showNavigation={false} />
      <main className="legal-page-main">{children}</main>
      <SiteFooter layout={layout} locale={locale} pathname={pathname} />
    </div>
  );
}
