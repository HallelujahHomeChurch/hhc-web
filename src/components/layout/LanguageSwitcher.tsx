'use client';

import {Select} from '@hallelujahhomechurch/ui';
import {getLocaleCookie, localeLabels, locales, type Locale} from '@/i18n/locales';
import {replaceLocale} from '@/i18n/navigation';

type LanguageSwitcherProps = {
  locale: Locale;
  pathname: string;
  label: string;
  variant?: 'default' | 'ghost';
};

export function LanguageSwitcher({label, locale, pathname, variant = 'default'}: LanguageSwitcherProps) {
  const triggerClassName = variant === 'ghost'
    ? 'legal-language-trigger'
    : 'site-language-trigger';

  return (
    <div className="flex items-center">
      <Select
        hideLabel
        label={label}
        items={locales.map((targetLocale) => ({id: targetLocale, label: localeLabels[targetLocale]}))}
        selectedKey={locale}
        triggerClassName={triggerClassName}
        onSelectionChange={(targetLocale) => {
          const nextLocale = targetLocale as Locale;

          document.cookie = getLocaleCookie(nextLocale);
          window.location.href = replaceLocale(pathname, nextLocale);
        }}
      />
    </div>
  );
}
