'use client';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import type {PublicContentItem} from '@hallelujahhomechurch/hhc-web-client';
import {StatementBody} from './StatementBody';
export type StatementLabels = {close: string; hideToday: string; readFull: string; notice: string; date: string; notifications: string; notificationDescription: string; email: string};
export function StatementDialog({statement, labels, onClose}: {statement: PublicContentItem; labels: StatementLabels; onClose: (hideToday: boolean) => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [hideToday, setHideToday] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    heading.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby="statement-title" onCancel={(event) => {event.preventDefault(); onClose(hideToday);}} className="m-auto w-[min(760px,calc(100%-2rem))] max-w-none overflow-hidden rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/55">
    <div className="flex max-h-[min(88dvh,900px)] flex-col">
      <header className="flex shrink-0 items-start gap-4 border-b border-line px-6 py-5 max-[620px]:px-4">
        <div className="min-w-0 flex-1"><p className="mb-2 text-xs font-semibold tracking-widest text-primary">{labels.notice}</p><h2 id="statement-title" ref={heading} tabIndex={-1} lang={statement.resolvedLocale} className="text-2xl font-semibold leading-snug outline-none">{statement.title}</h2></div>
        <button type="button" aria-label={labels.close} onClick={() => onClose(hideToday)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-2xl hover:bg-primary/10">×</button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-6 max-[620px]:px-4"><StatementBody body={statement.body ?? ''} locale={statement.resolvedLocale} /></div>
      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-6 py-4 max-[620px]:px-4">
        <label className="mr-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={hideToday} onChange={(event) => setHideToday(event.target.checked)} className="h-4 w-4 accent-primary" />{labels.hideToday}</label>
        <Link href={statement.href ?? '#'} onClick={() => onClose(hideToday)} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-primary">{labels.readFull}</Link>
        <button type="button" onClick={() => onClose(hideToday)} className="min-h-11 rounded-lg bg-primary-solid px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-solid-hover">{labels.close}</button>
      </footer>
    </div>
  </dialog>;
}
