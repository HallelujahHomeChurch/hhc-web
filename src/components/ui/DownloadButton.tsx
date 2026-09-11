'use client';

import {useState} from 'react';
import {getSharedAccountSessionClient} from '@/lib/browser-bootstrap';

type DownloadButtonProps = {
  href: string;
  label: string;
  ariaLabel?: string;
  className?: string;
  variant?: 'primary' | 'outline';
  authenticated?: boolean;
};

const variants = {
  primary: 'border-primary-solid bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover',
  outline: 'border-[var(--hhc-control-border)] bg-paper text-[var(--hhc-control)] hover:border-primary hover:bg-primary hover:text-primary-foreground'
};

export function DownloadButton({href, label, ariaLabel, authenticated = false, className = '', variant = 'primary'}: DownloadButtonProps) {
  const [preparing, setPreparing] = useState(false);

  return (
    <a
      href={href}
      download
      aria-label={ariaLabel}
      aria-busy={preparing}
      aria-disabled={preparing}
      className={`relative inline-flex min-h-11 items-center justify-center rounded-full border px-5 font-semibold transition ${variants[variant]} ${className}`}
      onClick={(event) => {
        if (preparing) {
          event.preventDefault();
          return;
        }
        if (authenticated) {
          event.preventDefault();
          setPreparing(true);
          void downloadAuthenticated(href).catch(() => undefined).finally(() => setPreparing(false));
          return;
        }
        setPreparing(true);
        window.setTimeout(() => setPreparing(false), 1500);
      }}
    >
      {preparing ? <span data-download-spinner className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}
      <span className={preparing ? 'opacity-0' : undefined}>{label}</span>
    </a>
  );
}

async function downloadAuthenticated(href: string) {
  const {accessToken} = await getSharedAccountSessionClient().issueAccessToken();
  const response = await fetch(href, {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store'});
  if (!response.ok) throw new Error('Bulletin download failed');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = response.headers.get('content-disposition')?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1] ?? '';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
