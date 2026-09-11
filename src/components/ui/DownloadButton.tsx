'use client';

import {useEffect, useRef, useState} from 'react';
import {Toast} from '@hallelujahhomechurch/ui';
import {useAccountIdentity} from '@/components/layout/AccountControl';
import {getSharedAccountSessionClient} from '@/lib/browser-bootstrap';

type DownloadButtonProps = {
  href: string; label: string; ariaLabel?: string; className?: string;
  variant?: 'primary' | 'outline'; authenticated?: boolean; preparingLabel?: string; errorLabel?: string;
};
const variants = {
  primary: 'border-primary-solid bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover',
  outline: 'border-[var(--hhc-control-border)] bg-paper text-[var(--hhc-control)] hover:border-primary hover:bg-primary hover:text-primary-foreground'
};
export function DownloadButton({href, label, ariaLabel, authenticated = false, className = '', variant = 'primary', preparingLabel = '正在準備週報，完成後會自動下載。', errorLabel = '週報暫時無法下載，請稍後再試。'}: DownloadButtonProps) {
  const accountIdentity = useAccountIdentity();
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const objectURL = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const cancel = () => {
      controller.current?.abort();
      clearTimeout(timer.current);
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
      objectURL.current = null;
      setPreparing(false);
      setFailed(false);
    };
    const accountChanged = cancel;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hhc:account-state');
    window.addEventListener('hhc:account-state', accountChanged);
    channel?.addEventListener('message', accountChanged);
    return () => {cancel(); window.removeEventListener('hhc:account-state', accountChanged); channel?.close();};
  }, [href, authenticated, accountIdentity]);

  async function download() {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setPreparing(true); setFailed(false);
    try {
      const {accessToken} = await getSharedAccountSessionClient().issueAccessToken();
      request.signal.throwIfAborted();
      const response = await fetch(href, {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store', signal: request.signal});
      if (!response.ok) throw new Error('Bulletin download failed');
      const blob = await response.blob();
      request.signal.throwIfAborted();
      const url = URL.createObjectURL(blob); objectURL.current = url;
      const link = document.createElement('a'); link.href = url;
      link.download = response.headers.get('content-disposition')?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1] ?? '';
      link.click();
      timer.current = setTimeout(() => {URL.revokeObjectURL(url); if (objectURL.current === url) objectURL.current = null;}, 1000);
    } catch {
      if (!request.signal.aborted) setFailed(true);
    } finally {
      if (controller.current === request) setPreparing(false);
    }
  }
  return <>
    <a href={href} download aria-label={ariaLabel} aria-busy={preparing} aria-disabled={preparing}
      className={`relative inline-flex min-h-11 items-center justify-center rounded-full border px-5 font-semibold transition ${variants[variant]} ${className}`}
      onClick={(event) => {
        if (preparing) {event.preventDefault(); return;}
        if (authenticated) {event.preventDefault(); void download(); return;}
        setPreparing(true); timer.current = setTimeout(() => setPreparing(false), 1500);
      }}>
      {preparing ? <span data-download-spinner className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}
      <span className={preparing ? 'opacity-0' : undefined}>{label}</span>
    </a>
    {authenticated && preparing ? <Toast>{preparingLabel}</Toast> : null}
    {failed ? <Toast tone="danger">{errorLabel}</Toast> : null}
  </>;
}
