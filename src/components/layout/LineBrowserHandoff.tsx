'use client';

import {useEffect, useRef} from 'react';
import Image from 'next/image';
import {useTranslations} from 'next-intl';
import {ArrowUpRight} from 'lucide-react';
import {externalBrowserHref} from '@/lib/line-browser-handoff';

export function LineBrowserHandoff() {
  const t = useTranslations('site');
  const dialog = useRef<HTMLDialogElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const openLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (openLink.current) openLink.current.href = externalBrowserHref(window.location.href);
    element?.showModal();
    return () => element?.close();
  }, []);

  function close() {
    dialog.current?.close();
    retry.current?.focus();
  }

  return <main className="grid min-h-dvh place-items-center bg-paper px-6 py-12 text-ink">
    <section className="w-full max-w-sm text-center" aria-labelledby="line-browser-brand">
      <Image src="/assets/brand/logo.png" alt="" width={80} height={80} priority className="mx-auto size-20 object-contain" />
      <h1 id="line-browser-brand" className="mt-5 text-2xl font-semibold text-[var(--hhc-brand-ui)]">{t('name')}</h1>
      {t('name') !== t('englishName') && <p className="mt-2 text-xs tracking-wide text-muted">{t('englishName')}</p>}
      <p className="mt-8 text-sm leading-relaxed text-muted">{t('lineBrowser.description')}</p>
      <button ref={retry} type="button" onClick={() => dialog.current?.showModal()} className="mt-5 min-h-11 rounded-xl border border-line px-5 font-semibold hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('lineBrowser.retry')}</button>
      <p className="mt-5 text-xs leading-relaxed text-muted">{t('lineBrowser.manual')}</p>
    </section>
    <dialog ref={dialog} aria-labelledby="line-browser-title" aria-describedby="line-browser-description" onCancel={event => {event.preventDefault(); close();}} className="m-auto w-[min(440px,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] max-w-none overflow-auto rounded-2xl border border-line bg-panel p-6 text-ink shadow-2xl backdrop:bg-black/45">
      <h2 id="line-browser-title" className="text-xl font-semibold">{t('lineBrowser.title')}</h2>
      <p id="line-browser-description" className="mt-3 text-sm leading-relaxed text-muted">{t('lineBrowser.description')}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={close} className="min-h-11 rounded-xl border border-line px-5 font-semibold hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('lineBrowser.cancel')}</button>
        <a ref={openLink} onClick={close} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-solid px-5 font-semibold text-primary-foreground hover:bg-primary-solid-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{t('lineBrowser.open')}<ArrowUpRight size={17} aria-hidden="true" /></a>
      </div>
    </dialog>
  </main>;
}
