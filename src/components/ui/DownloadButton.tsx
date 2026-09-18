'use client';

import {useEffect, useRef, useState} from 'react';
import {Toast} from '@hallelujahhomechurch/ui';
import type {WeeklyBulletin} from '@/features/weekly/types';
import {useAccountIdentity} from '@/components/layout/AccountControl';
import {parseDownloadFilename} from '@/lib/content-disposition';
import {isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {captureHandledError} from '@/lib/observability';

type DownloadButtonProps = {
  bulletin: WeeklyBulletin;
  download: (bulletin: WeeklyBulletin, signal?: AbortSignal) => Promise<Response>;
  label: string;
  ariaLabel?: string;
  className?: string;
  variant?: 'primary' | 'outline';
  preparingLabel?: string;
  readyLabel?: string;
  errorLabel?: string;
};

const variants = {
  primary: 'border-primary-solid bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover',
  outline: 'border-[var(--hhc-control-border)] bg-paper text-[var(--hhc-control)] hover:border-primary hover:bg-primary hover:text-primary-foreground'
};

export function DownloadButton({
  bulletin,
  download,
  label,
  ariaLabel,
  className = '',
  variant = 'primary',
  preparingLabel = '正在準備週報，完成後會自動下載。',
  readyLabel = '週報已準備完成，請再次點選按鈕開啟。',
  errorLabel = '週報暫時無法下載，請稍後再試。'
}: DownloadButtonProps) {
  const accountIdentity = useAccountIdentity();
  const [preparing, setPreparing] = useState(false);
  const [readyDownload, setReadyDownload] = useState<{url: string; filename: string} | null>(null);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const objectURL = useRef<string | null>(null);

  useEffect(() => () => {
    controller.current?.abort();
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
  }, [accountIdentity, bulletin.issueId, bulletin.locale]);

  async function startDownload() {
    if (preparing) return;
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setPreparing(true);
    setFailed(false);
    try {
      const response = await download(bulletin, request.signal);
      const blob = await response.blob();
      request.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      objectURL.current = url;
      const filename = parseDownloadFilename(response.headers.get('content-disposition'), bulletin.downloadName);
      if (isStandaloneWebApp()) {
        setReadyDownload({url, filename});
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        if (objectURL.current === url) objectURL.current = null;
      }, 1_000);
    } catch (error) {
      if (!request.signal.aborted) {
        captureHandledError(error, {operation: 'weekly.download'});
        setFailed(true);
      }
    } finally {
      if (controller.current === request) setPreparing(false);
    }
  }

  const classes = `relative inline-flex min-h-11 items-center justify-center rounded-full border px-5 font-semibold transition ${variants[variant]} ${className}`;
  const content = <><span className={preparing ? 'opacity-0' : undefined}>{label}</span>{preparing ? <span data-download-spinner className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}</>;

  return <>
    {readyDownload ? (
      <a href={readyDownload.url} download={readyDownload.filename} target="_blank" rel="noopener" aria-label={ariaLabel} className={classes} onClick={() => {
        URL.revokeObjectURL(readyDownload.url);
        if (objectURL.current === readyDownload.url) objectURL.current = null;
        setReadyDownload(null);
      }}>{content}</a>
    ) : (
      <button type="button" aria-label={ariaLabel} aria-busy={preparing} disabled={preparing} className={classes} onClick={() => void startDownload()}>{content}</button>
    )}
    {preparing || readyDownload || failed ? <div className="hhc-toast-region fixed bottom-4 right-4 z-50 max-w-[min(24rem,calc(100vw-2rem))]">
      {preparing ? <Toast>{preparingLabel}</Toast> : null}
      {readyDownload ? <Toast>{readyLabel}</Toast> : null}
      {failed ? <Toast tone="danger">{errorLabel}</Toast> : null}
    </div> : null}
  </>;
}
