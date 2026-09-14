'use client';

import {useEffect, useRef, useState} from 'react';
import {Toast} from '@hallelujahhomechurch/ui';
import {useAccountIdentity} from '@/components/layout/AccountControl';
import {getSharedAccountSessionClient} from '@/lib/browser-bootstrap';
import {parseDownloadFilename} from '@/lib/content-disposition';
import {isStandaloneWebApp} from '@/lib/pwa-capabilities';

type DownloadButtonProps = {
  href: string; label: string; ariaLabel?: string; className?: string;
  variant?: 'primary' | 'outline'; authenticated?: boolean; preparingLabel?: string; readyLabel?: string; errorLabel?: string;
};
const variants = {
  primary: 'border-primary-solid bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover',
  outline: 'border-[var(--hhc-control-border)] bg-paper text-[var(--hhc-control)] hover:border-primary hover:bg-primary hover:text-primary-foreground'
};

type DownloadJob = {id: string; status: 'queued' | 'running' | 'ready' | 'failed' | 'expired'; progress?: number};
const jobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function downloadTarget(href: string) {
  const requested = new URL(href, window.location.origin);
  const issueDate = requested.pathname.match(/^\/api\/member\/bulletin-downloads\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (!issueDate) return null;
  const locale = requested.searchParams.get('locale') ?? 'zh-Hant';
  return {issueDate, locale, storageKey: `hhc:bulletin-download:${issueDate}:${locale}`};
}

function waitForPoll(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const handle = setTimeout(done, ms);
    function done() { clearTimeout(handle); signal.removeEventListener('abort', aborted); document.removeEventListener('visibilitychange', visible); resolve(); }
    function aborted() { clearTimeout(handle); document.removeEventListener('visibilitychange', visible); reject(new DOMException('Aborted', 'AbortError')); }
    function visible() { if (!document.hidden) done(); }
    signal.addEventListener('abort', aborted, {once: true});
    document.addEventListener('visibilitychange', visible);
  });
}

async function readJob(response: Response) {
  if (!response.ok) throw new Error('Bulletin preparation failed');
  const payload = await response.json() as {data?: DownloadJob};
  if (!payload.data || !jobId.test(payload.data.id)) throw new Error('Invalid bulletin preparation');
  return payload.data;
}
export function DownloadButton({href, label, ariaLabel, authenticated = false, className = '', variant = 'primary', preparingLabel = '正在準備週報，完成後會自動下載。', readyLabel = '週報已準備完成，請再次點選按鈕開啟。', errorLabel = '週報暫時無法下載，請稍後再試。'}: DownloadButtonProps) {
  const accountIdentity = useAccountIdentity();
  const [preparing, setPreparing] = useState(false);
  const [readyDownload, setReadyDownload] = useState<{url: string; filename: string} | null>(null);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(5);
  const controller = useRef<AbortController | null>(null);
  const objectURL = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const cancel = () => {
      controller.current?.abort();
      clearTimeout(timer.current);
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
      objectURL.current = null;
      setReadyDownload(null);
      setPreparing(false);
      setFailed(false);
      setProgress(5);
    };
    const accountChanged = cancel;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hhc:account-state');
    window.addEventListener('hhc:account-state', accountChanged);
    channel?.addEventListener('message', accountChanged);
    return () => {cancel(); window.removeEventListener('hhc:account-state', accountChanged); channel?.close();};
  }, [href, authenticated, accountIdentity]);

  async function download(existingID?: string) {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setPreparing(true); setFailed(false);
    try {
      const target = downloadTarget(href);
      if (!target) throw new Error('Invalid bulletin URL');
      const {accessToken} = await getSharedAccountSessionClient().issueAccessToken();
      request.signal.throwIfAborted();
      const headers = {Authorization: `Bearer ${accessToken}`};
      let response: Response;
      let job: DownloadJob;
      if (existingID) {
        response = await fetch(`/api/member/bulletin-download-jobs/${existingID}`, {headers, cache: 'no-store', signal: request.signal});
        if (response.status === 404 || response.status === 409) {localStorage.removeItem(target.storageKey); return;}
        job = await readJob(response);
      } else {
        response = await fetch('/api/member/bulletin-download-jobs', {
          method: 'POST', headers: {...headers, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID()},
          body: JSON.stringify({issueDate: target.issueDate, locale: target.locale}), cache: 'no-store', signal: request.signal,
        });
        job = await readJob(response);
        localStorage.setItem(target.storageKey, job.id);
      }
      setProgress(job.progress ?? (job.status === 'ready' ? 100 : 5));
      const statusURL = `/api/member/bulletin-download-jobs/${job.id}`;
      while (job.status === 'queued' || job.status === 'running') {
        const seconds = Math.min(5, Math.max(1, Number(response.headers.get('Retry-After')) || 2));
        await waitForPoll((document.hidden ? Math.max(5, seconds) : seconds) * 1000, request.signal);
        response = await fetch(statusURL, {headers, cache: 'no-store', signal: request.signal});
        job = await readJob(response);
        setProgress(job.progress ?? (job.status === 'ready' ? 100 : 5));
      }
      if (job.status !== 'ready') {localStorage.removeItem(target.storageKey); throw new Error('Bulletin preparation failed');}
      response = await fetch(`${statusURL}/file`, {headers, cache: 'no-store', signal: request.signal});
      if (!response.ok) throw new Error('Bulletin download failed');
      const blob = await response.blob();
      request.signal.throwIfAborted();
      const url = URL.createObjectURL(blob); objectURL.current = url;
      const filename = parseDownloadFilename(response.headers.get('content-disposition'));
      if (isStandaloneWebApp()) {
        setReadyDownload({url, filename});
        return;
      }
      const link = document.createElement('a'); link.href = url;
      link.download = filename;
      link.click();
      localStorage.removeItem(target.storageKey);
      timer.current = setTimeout(() => {URL.revokeObjectURL(url); if (objectURL.current === url) objectURL.current = null;}, 1000);
    } catch {
      if (!request.signal.aborted) setFailed(true);
    } finally {
      if (controller.current === request) setPreparing(false);
    }
  }
  useEffect(() => {
    if (!authenticated) return;
    const target = downloadTarget(href);
    const stored = target ? localStorage.getItem(target.storageKey) : null;
    const handle = stored && jobId.test(stored) ? setTimeout(() => void download(stored), 0) : undefined;
    return () => clearTimeout(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, authenticated]);
  return <>
    <a href={readyDownload?.url ?? href} download={readyDownload?.filename ?? true} target={readyDownload ? '_blank' : undefined} rel={readyDownload ? 'noopener' : undefined} aria-label={ariaLabel} aria-busy={preparing} aria-disabled={preparing}
      className={`relative inline-flex min-h-11 items-center justify-center rounded-full border px-5 font-semibold transition ${variants[variant]} ${className}`}
      onClick={(event) => {
        if (preparing) {event.preventDefault(); return;}
        if (readyDownload) {
          const target = downloadTarget(href); if (target) localStorage.removeItem(target.storageKey);
          timer.current = setTimeout(() => {
            URL.revokeObjectURL(readyDownload.url);
            if (objectURL.current === readyDownload.url) objectURL.current = null;
            setReadyDownload(null);
          }, 1000);
          return;
        }
        if (authenticated) {event.preventDefault(); void download(); return;}
        setPreparing(true); timer.current = setTimeout(() => setPreparing(false), 1500);
      }}>
      {preparing ? <span data-download-spinner className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}
      <span className={preparing ? 'opacity-0' : undefined}>{label}</span>
    </a>
    {(authenticated && preparing) || readyDownload || failed ? <div className="hhc-toast-region fixed bottom-4 right-4 z-50 max-w-[min(24rem,calc(100vw-2rem))]">
      {authenticated && preparing ? <Toast>{preparingLabel.replace('{progress}', String(progress))}</Toast> : null}
      {readyDownload ? <Toast>{readyLabel}</Toast> : null}
      {failed ? <Toast tone="danger">{errorLabel}</Toast> : null}
    </div> : null}
  </>;
}
