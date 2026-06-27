'use client';

import * as Select from '@radix-ui/react-select';
import {getLocaleCookie, localeLabels, locales, type Locale} from '@/i18n/locales';
import {replaceLocale} from '@/i18n/navigation';

type LanguageSwitcherProps = {
  locale: Locale;
  pathname: string;
  label: string;
};

export function LanguageSwitcher({label, locale, pathname}: LanguageSwitcherProps) {
  return (
    <div className="flex items-center">
      <Select.Root
        value={locale}
        onValueChange={(targetLocale) => {
          const nextLocale = targetLocale as Locale;

          document.cookie = getLocaleCookie(nextLocale);
          window.location.href = replaceLocale(pathname, nextLocale);
        }}
      >
        <Select.Trigger
          aria-label={label}
          className="inline-flex min-h-11 min-w-24 items-center justify-between gap-3 rounded-full border border-[#d7b9aa] bg-paper px-4 text-sm font-semibold text-[#7a423b] transition hover:border-primary focus-visible:border-primary focus-visible:bg-primary-soft focus-visible:outline-none data-[state=open]:border-primary data-[state=open]:bg-primary-soft"
        >
          <Select.Value />
          <Select.Icon className="text-xs text-muted" aria-hidden="true">
            v
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={8}
            className="z-50 overflow-hidden rounded-[24px] border border-panel-border bg-paper p-2 text-sm text-ink shadow-warm"
          >
            <Select.Viewport>
              {locales.map((targetLocale) => (
                <Select.Item
                  key={targetLocale}
                  value={targetLocale}
                  className="relative flex min-h-10 cursor-pointer select-none items-center rounded-full px-4 pr-9 font-semibold outline-none data-highlighted:bg-primary-soft data-highlighted:text-primary data-[state=checked]:text-primary"
                >
                  <Select.ItemText>{localeLabels[targetLocale]}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3 text-primary">✓</Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
