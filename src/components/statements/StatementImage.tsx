'use client';

import {useEffect, useRef} from 'react';

export function StatementImage({src, alt, openLabel, closeLabel}: {src: string; alt: string; openLabel: string; closeLabel: string}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef<string | null>(null);

  useEffect(() => () => {
    if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
  }, []);

  function open() {
    if (!dialog.current || dialog.current.open) return;
    if (document.body.style.overflow !== 'hidden') {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialog.current.showModal();
    closeButton.current?.focus();
  }

  function restore() {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    if (trigger.current?.isConnected) trigger.current.focus();
  }

  return <>
    <button ref={trigger} type="button" aria-label={alt ? `${openLabel}: ${alt}` : openLabel} onClick={open} className="block w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      {/* eslint-disable-next-line @next/next/no-img-element -- CMS URLs are already transformed and size metadata is not part of the v1 contract. */}
      <img src={src} alt={alt} className="h-auto w-full rounded-lg" />
    </button>
    <dialog ref={dialog} aria-label={openLabel} onCancel={(event) => {event.preventDefault(); event.stopPropagation(); dialog.current?.close();}} onClose={restore} className="m-auto max-h-[100dvh] max-w-[100vw] overflow-auto border-0 bg-transparent p-4 text-white backdrop:bg-black/85">
      <div className="flex flex-col items-end gap-3">
        <button ref={closeButton} type="button" aria-label={closeLabel} onClick={() => dialog.current?.close()} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-3xl focus-visible:outline-2 focus-visible:outline-white">×</button>
        {/* eslint-disable-next-line @next/next/no-img-element -- Enlarged view reuses the public asset URL. */}
        <img src={src} alt={alt} className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-2rem)] object-contain" />
      </div>
    </dialog>
  </>;
}
