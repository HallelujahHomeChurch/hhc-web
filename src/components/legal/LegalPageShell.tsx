import Image from 'next/image';
import Link from 'next/link';
import type {ReactNode} from 'react';
import type {Locale} from '@/i18n/locales';
import {LanguageSwitcher} from '@/components/layout/LanguageSwitcher';

type LegalPageShellProps = {
  children: ReactNode;
  languageLabel: string;
  locale: Locale;
  pathname: string;
  siteName: string;
};

export function LegalPageShell({children, languageLabel, locale, pathname, siteName}: LegalPageShellProps) {
  return (
    <div className="legal-page-shell">
      <header className="legal-page-header">
        <Link href={`/${locale}`} className="legal-page-brand" aria-label={siteName}>
          <Image src="/assets/brand/logo.png" alt="" width={40} height={40} priority />
          <strong>{siteName}</strong>
        </Link>
      </header>
      <main className="legal-page-main">{children}</main>
      <footer className="legal-page-footer">
        <LanguageSwitcher label={languageLabel} locale={locale} pathname={pathname} />
      </footer>
    </div>
  );
}
