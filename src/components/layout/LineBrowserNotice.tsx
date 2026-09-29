'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {ArrowUpRight, PanelTopOpen} from 'lucide-react';
import {isStatementDetailPath, isStatementSuppressedPath} from '@/features/statements/visibility';
import {useStatement} from '@/components/statements/StatementProvider';

const dismissalKey = 'hhc:line-browser-notice:dismissed';

export const isLineBrowser = (userAgent: string) => /\bLINE\/\d/i.test(userAgent);

export function externalBrowserHref(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.set('openExternalBrowser', '1');
  return url.href;
}

export function useLineBrowserNotice(pathname: string) {
  const dismissed = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLineBrowser(navigator.userAgent) || isStatementSuppressedPath(pathname) || dismissed.current) {
      setVisible(false);
      return;
    }
    try { dismissed.current = sessionStorage.getItem(dismissalKey) === '1'; } catch { /* Keep the notice usable without storage. */ }
    setVisible(!dismissed.current);
  }, [pathname]);

  function close() {
    dismissed.current = true;
    setVisible(false);
    try { sessionStorage.setItem(dismissalKey, '1'); } catch { /* This mounted page still remembers dismissal. */ }
  }

  return {visible, close};
}

export function LineBrowserNotice({pathname, onClose}: {pathname: string; onClose: () => void}) {
  const t = useTranslations('site.lineBrowser');
  const statement = useStatement();
  const activeStatement = statement?.statement;

  return <aside className="border-b border-primary/20 border-l-4 border-l-primary bg-primary/5 text-ink shadow-sm" aria-label={t('region')}>
    <div className="shell relative py-4 pr-12 text-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary" aria-hidden="true"><PanelTopOpen size={21} /></span>
        <div className="min-w-0">
          <strong className="block text-[15px] text-primary">{t('title')}</strong>
          <p className="mt-1 text-xs leading-relaxed text-ink/70">{t('description')}</p>
        </div>
      </div>
      <button type="button" className="absolute right-4 top-3 grid size-8 place-items-center rounded-lg text-xl text-ink/60 hover:bg-primary/10" onClick={onClose} aria-label={t('close')}>×</button>
      <a className="mt-3 ml-12 inline-flex min-h-11 w-[calc(100%-3rem)] items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-white hover:bg-primary/90 sm:w-auto" href={externalBrowserHref(window.location.href)}>{t('open')} <ArrowUpRight size={17} aria-hidden="true" /></a>
      {activeStatement && !isStatementDetailPath(pathname) && <div className="mt-3 ml-12 border-t border-primary/20 pt-2 text-xs">
        <Link className="font-semibold text-primary underline-offset-2 hover:underline" href={activeStatement.href ?? '#'}>
          <span lang={activeStatement.resolvedLocale}>{activeStatement.title}</span> · {statement?.labels.readFull} →
        </Link>
      </div>}
      <p className="mt-2 ml-12 text-xs text-ink/60">{t('manual')}</p>
    </div>
  </aside>;
}
