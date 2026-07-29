'use client';

import {useEffect} from 'react';
import {detectLocale, getStoredLocale} from '@/i18n/locales';

export default function RootPage() {
  useEffect(() => {
    const locale = getStoredLocale(document.cookie) ?? detectLocale(navigator.languages.length > 0 ? navigator.languages : [navigator.language]);

    window.location.replace(`/${locale}`);
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 py-16 text-ink">
      <p className="text-sm font-semibold text-muted">Loading...</p>
    </main>
  );
}
