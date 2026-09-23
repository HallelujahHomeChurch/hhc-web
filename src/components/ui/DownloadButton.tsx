'use client';

import {useEffect, useRef, useState} from 'react';
import {ProgressBar, Toast} from '@hallelujahhomechurch/ui';
import type {WeeklyBulletinApi} from '@/features/weekly/api';
import type {WeeklyBulletin} from '@/features/weekly/types';
import {useAccountIdentity} from '@/components/layout/AccountControl';
import {parseDownloadFilename} from '@/lib/content-disposition';
import {isStandaloneWebApp} from '@/lib/pwa-capabilities';
import {captureHandledError} from '@/lib/observability';

type DownloadWorkflow = Pick<WeeklyBulletinApi, 'createDownloadJob' | 'getDownloadJob' | 'downloadPreparedBulletin'>;
type PersistedDownloadAttempt = {idempotencyKey: string; jobId?: string};

type DownloadButtonProps = {
  bulletin: WeeklyBulletin;
  workflow: DownloadWorkflow;
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
  ...props
}: DownloadButtonProps) {
  const accountIdentity = useAccountIdentity();
  const storageKey = `weekly-download-job:${accountIdentity ?? 'anonymous'}:${bulletin.issueId}:${bulletin.locale}`;
  return <DownloadButtonWorkflow key={storageKey} bulletin={bulletin} storageKey={storageKey} {...props} />;
}

function DownloadButtonWorkflow({
  bulletin,
  storageKey,
  workflow,
  label,
  ariaLabel,
  className = '',
  variant = 'primary',
  preparingLabel = '正在準備下載週報 {progress} %。',
  readyLabel = '週報已準備完成，請再次點選按鈕開啟。',
  errorLabel = '週報暫時無法下載，請稍後再試。'
}: DownloadButtonProps & {storageKey: string}) {
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readyDownload, setReadyDownload] = useState<{url: string; filename: string} | null>(null);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef<PersistedDownloadAttempt | null>(null);
  const objectURL = useRef<string | null>(null);

  useEffect(() => {
    controller.current?.abort();
    clearPollTimer();
    attempt.current = readAttempt(storageKey);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearPollTimer();
      else if (attempt.current?.jobId && controller.current && !controller.current.signal.aborted) void pollJob(controller.current);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (attempt.current?.jobId) void runAttempt(attempt.current);
    return () => {
      controller.current?.abort();
      clearPollTimer();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    };
    // workflow is stable in callers; storageKey remounts this child on account or bulletin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, workflow]);

  function clearPollTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function schedulePoll(delay: number, request: AbortController) {
    clearPollTimer();
    if (document.visibilityState === 'hidden' || request.signal.aborted) return;
    timer.current = setTimeout(() => void pollJob(request), Math.min(10_000, Math.max(1_000, delay)));
  }

  async function pollJob(request: AbortController) {
    const jobId = attempt.current?.jobId;
    if (!jobId || request.signal.aborted || document.visibilityState === 'hidden') return;
    try {
      await handleJob(await workflow.getDownloadJob(bulletin, jobId, request.signal), request);
    } catch (error) {
      handleFailure(error, request);
    }
  }

  async function handleJob(job: Awaited<ReturnType<DownloadWorkflow['getDownloadJob']>>, request: AbortController) {
    request.signal.throwIfAborted();
    setProgress(job.operationProgress.percent);
    if (job.operationProgress.status === 'failed') {
      clearAttempt();
      setPreparing(false);
      setFailed(true);
      return;
    }
    if (job.operationProgress.status !== 'ready') {
      schedulePoll(job.operationProgress.retryAfterMs, request);
      return;
    }

    const response = await workflow.downloadPreparedBulletin(bulletin, job.id, request.signal);
    const blob = await response.blob();
    request.signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    objectURL.current = url;
    const filename = parseDownloadFilename(response.headers.get('content-disposition'), bulletin.downloadName);
    clearAttempt();
    setPreparing(false);
    setProgress(100);
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
  }

  function handleFailure(error: unknown, request: AbortController) {
    if (request.signal.aborted) return;
    if (isTerminalJobError(error)) clearAttempt();
    captureHandledError(error, {operation: 'weekly.download'});
    setPreparing(false);
    setFailed(true);
  }

  function clearAttempt() {
    localStorage.removeItem(storageKey);
    attempt.current = null;
    clearPollTimer();
  }

  async function runAttempt(persisted: PersistedDownloadAttempt) {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    attempt.current = persisted;
    setPreparing(true);
    setFailed(false);
    try {
      if (persisted.jobId) {
        await handleJob(await workflow.getDownloadJob(bulletin, persisted.jobId, request.signal), request);
        return;
      }
      const job = await workflow.createDownloadJob(bulletin, persisted.idempotencyKey, request.signal);
      const next = {...persisted, jobId: job.id};
      attempt.current = next;
      localStorage.setItem(storageKey, JSON.stringify(next));
      await handleJob(job, request);
    } catch (error) {
      handleFailure(error, request);
    }
  }

  function startDownload() {
    if (preparing) return;
    const persisted = readAttempt(storageKey) ?? {idempotencyKey: crypto.randomUUID()};
    localStorage.setItem(storageKey, JSON.stringify(persisted));
    void runAttempt(persisted);
  }

  const classes = `relative inline-flex min-h-11 items-center justify-center rounded-full border px-5 font-semibold transition ${variants[variant]} ${className}`;
  const content = <><span className={preparing ? 'opacity-0' : undefined}>{label}</span>{preparing ? <span data-download-spinner className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}</>;
  const progressLabel = preparingLabel.replace('{progress}', String(Math.round(progress)));

  return <>
    {readyDownload ? (
      <a href={readyDownload.url} download={readyDownload.filename} target="_blank" rel="noopener" aria-label={ariaLabel} className={classes} onClick={() => {
        URL.revokeObjectURL(readyDownload.url);
        if (objectURL.current === readyDownload.url) objectURL.current = null;
        setReadyDownload(null);
      }}>{content}</a>
    ) : (
      <button type="button" aria-label={ariaLabel} aria-busy={preparing} disabled={preparing} className={classes} onClick={startDownload}>{content}</button>
    )}
    {preparing || readyDownload || failed ? <div className="hhc-toast-region fixed bottom-4 right-4 z-50 max-w-[min(24rem,calc(100vw-2rem))]">
      {preparing ? <Toast><div className="grid gap-2"><ProgressBar value={progress} aria-label={progressLabel} size="sm"><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track></ProgressBar><span>{progressLabel}</span></div></Toast> : null}
      {readyDownload ? <Toast>{readyLabel}</Toast> : null}
      {failed ? <Toast tone="danger">{errorLabel}</Toast> : null}
    </div> : null}
  </>;
}

function readAttempt(key: string): PersistedDownloadAttempt | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<PersistedDownloadAttempt> | null;
    return value && typeof value.idempotencyKey === 'string' && (!value.jobId || typeof value.jobId === 'string') ? {idempotencyKey: value.idempotencyKey, jobId: value.jobId} : null;
  } catch {
    return null;
  }
}

function isTerminalJobError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error ? error.status : undefined;
  const code = 'code' in error ? error.code : undefined;
  return status === 404 || status === 409 || code === 'http_404' || code === 'http_409';
}
