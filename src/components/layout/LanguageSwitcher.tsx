'use client';

import {Select} from '@hallelujahhomechurch/ui';
import {useRef, useState} from 'react';
import {getLocaleCookie, localeMetadata, type Locale} from '@/i18n/locales';
import {replaceLocale} from '@/i18n/navigation';

type LanguageSwitcherProps = {
  locale: Locale;
  pathname: string;
  label: string;
  navigate?: (href: string) => void;
};

export function LanguageSwitcher({label, locale, pathname, navigate = (href) => window.location.assign(href)}: LanguageSwitcherProps) {
  const navigationStarted = useRef(false);
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [isNavigating, setNavigating] = useState(false);

  return (
    <div className="flex items-center" aria-busy={isNavigating}>
      <Select
        hideLabel
        label={label}
        items={localeMetadata.map(({code, nativeLabel, shortLabel}) => ({id: code, label: shortLabel, ariaLabel: nativeLabel}))}
        selectedKey={selectedLocale}
        variant="utility"
        isDisabled={isNavigating}
        onSelectionChange={(targetLocale) => {
          const nextLocale = targetLocale as Locale;

          if (navigationStarted.current || nextLocale === selectedLocale) return;
          navigationStarted.current = true;
          setNavigating(true);
          setSelectedLocale(nextLocale);
          document.cookie = getLocaleCookie(nextLocale);
          navigate(replaceLocale(pathname, nextLocale));
        }}
      />
    </div>
  );
}
