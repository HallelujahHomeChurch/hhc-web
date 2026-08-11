'use client';

import {useState} from 'react';

type DownloadButtonProps = {
  href: string;
  label: string;
  ariaLabel?: string;
  className?: string;
  variant?: 'primary' | 'outline';
};

const variants = {
  primary: 'border-primary-solid bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover',
  outline: 'border-[var(--hhc-control-border)] bg-paper text-[var(--hhc-control)] hover:border-primary hover:bg-primary hover:text-primary-foreground'
};

export function DownloadButton({href, label, ariaLabel, className = '', variant = 'primary'}: DownloadButtonProps) {
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
        setPreparing(true);
        window.setTimeout(() => setPreparing(false), 1500);
      }}
    >
      {preparing ? <span data-download-spinner className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" /> : null}
      <span className={preparing ? 'opacity-0' : undefined}>{label}</span>
    </a>
  );
}
