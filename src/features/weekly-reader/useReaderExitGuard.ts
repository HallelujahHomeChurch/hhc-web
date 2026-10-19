import {useCallback, useEffect, useEffectEvent, useRef, useState} from 'react';
import type {AlertDialogProps} from '@hallelujahhomechurch/ui';
import type {ReaderMessages} from '@/components/weekly-reader/ReaderToolbar';

type Kind = 'home' | 'back';
type Marker = {id: string; url: string; position: 'base' | 'guard'};

export function useReaderExitGuard({hasUnsavedNote, beforeLeave, messages: m, canPrompt = () => true, hasUnsavedChanges = () => false}: {
  hasUnsavedChanges?: () => boolean; canPrompt?: () => boolean; hasUnsavedNote: () => boolean; beforeLeave: () => Promise<boolean>; messages: ReaderMessages;
}) {
  const [prompt, setPrompt] = useState<{kind: Kind; dirty: boolean; uncommitted: boolean} | null>(null);
  const active = useRef(true);
  const pending = useRef<{promise: Promise<boolean>; resolve: (allowed: boolean) => void; confirmed: boolean} | null>(null);
  const settle = useCallback((allowed: boolean) => {
    const request = pending.current; pending.current = null;
    request?.resolve(allowed);
    if (active.current) setPrompt(null);
  }, []);
  const confirmLeave = useCallback((kind: Kind) => {
    // Only the first caller owns navigation; a second source must not also leave.
    if (pending.current || !canPrompt()) return Promise.resolve(false);
    let resolve!: (allowed: boolean) => void;
    const promise = new Promise<boolean>(finish => {resolve = finish;});
    pending.current = {promise, resolve, confirmed: false};
    setPrompt({kind, dirty: hasUnsavedNote(), uncommitted: hasUnsavedChanges()});
    return promise;
  }, [hasUnsavedNote, hasUnsavedChanges, canPrompt]);
  const requestBack = useEffectEvent(() => confirmLeave('back'));
  useEffect(() => {
    active.current = true;
    const url = window.location.href;
    const existing = history.state?.__hhcReaderExit as Marker | undefined;
    const marker = existing?.url === url && typeof existing.id === 'string' && ['base', 'guard'].includes(existing.position)
      ? existing : null;
    const id = marker?.id ?? crypto.randomUUID();
    let disposed = false, released = false, backPending = false;
    let restoring: Promise<void> | null = null, restored: (() => void) | null = null;
    const restore = () => {
      if (!restoring) {
        restoring = new Promise<void>(resolve => {restored = resolve;});
        history.go(1);
      }
      return restoring;
    };
    const pop = (event: PopStateEvent) => {
      if (released) return;
      const incoming = event.state?.__hhcReaderExit as Marker | undefined;
      if (incoming?.id !== id || incoming.url !== url) return;
      // Consume only our same-URL entries; preserve Next.js and offline route state.
      event.stopImmediatePropagation();
      if (incoming.position === 'guard') {restored?.(); restoring = null; restored = null; return;}
      const ready = restore();
      if (backPending) return;
      backPending = true;
      void Promise.all([ready, requestBack()]).then(([, allowed]) => {
        backPending = false;
        if (!disposed && allowed) {released = true; history.go(-2);}
      });
    };
    window.addEventListener('popstate', pop, true);
    if (marker?.position === 'base') void restore();
    else if (!marker && history.length > 1) {
      history.replaceState({...history.state, __hhcReaderExit: {id, url, position: 'base'}}, '', url);
      history.pushState({...history.state, __hhcReaderExit: {id, url, position: 'guard'}}, '', url);
    }
    return () => {
      disposed = true; active.current = false;
      window.removeEventListener('popstate', pop, true);
      restored?.(); pending.current?.resolve(false); pending.current = null;
    };
  }, []);
  const dialogProps: AlertDialogProps = {
    title: m.exitTitle, description: [m.exitDescription, prompt?.dirty ? m.noteDiscardConfirm : '', prompt?.uncommitted ? m.exitUnsavedChanges : ''].filter(Boolean).join(' '),
    isOpen: !!prompt, cancelLabel: m.keepReading, closeLabel: m.close,
    confirmLabel: m.exitConfirm,
    confirmVariant: 'primary',
    onOpenChange: open => {if (!open && !pending.current?.confirmed) settle(false);},
    onConfirm: async () => {
      const request = pending.current;
      if (!request || request.confirmed) return;
      request.confirmed = true;
      let allowed = false;
      try {allowed = await beforeLeave();} catch { /* Leave failures cancel without discarding state. */ }
      if (active.current && pending.current === request) settle(allowed);
    }
  };
  return {confirmLeave, dialogProps};
}
