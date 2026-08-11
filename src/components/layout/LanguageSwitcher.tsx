'use client';

import {Select} from '@hallelujahhomechurch/ui';
import {getLocaleCookie, localeMetadata, type Locale} from '@/i18n/locales';
import {replaceLocale} from '@/i18n/navigation';

type LanguageSwitcherProps = {
  locale: Locale;
  pathname: string;
  label: string;
};

export function LanguageSwitcher({label, locale, pathname}: LanguageSwitcherProps) {
  return (
    <div className="flex items-center">
      <Select
        hideLabel
        label={label}
        items={localeMetadata.map(({code, nativeLabel, shortLabel}) => ({id: code, label: shortLabel, ariaLabel: nativeLabel}))}
        selectedKey={locale}
        variant="utility"
        onSelectionChange={(targetLocale) => {
          const nextLocale = targetLocale as Locale;

          document.cookie = getLocaleCookie(nextLocale);
          window.location.href = replaceLocale(pathname, nextLocale);
        }}
      />
    </div>
  );
}
