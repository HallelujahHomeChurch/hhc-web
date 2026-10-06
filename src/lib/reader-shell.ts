import type {Locale} from '@/i18n/locales';

export async function prepareOfflineReaderShell(locale: Locale, signal?: AbortSignal) {
  if (!('serviceWorker' in navigator) || typeof MessageChannel === 'undefined') throw new Error('offline_unsupported');
  await navigator.serviceWorker.register('/sw.js');
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout); signal?.removeEventListener('abort', abort);
      channel.port1.close(); channel.port2.close();
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new Error('offline_save_aborted'));
    const timeout = setTimeout(() => finish(new Error('offline_shell_unavailable')), 30000);
    signal?.addEventListener('abort', abort, {once: true});
    channel.port1.onmessage = event => finish(event.data?.ok === true ? undefined : new Error('offline_shell_unavailable'));
    void navigator.serviceWorker.ready.then(registration => {
      if (finished || signal?.aborted) return;
      if (!registration.active) {finish(new Error('offline_shell_unavailable')); return;}
      registration.active.postMessage({type: 'PREPARE_READER_SHELL', locale}, [channel.port2]);
    }).catch(() => finish(new Error('offline_shell_unavailable')));
  });
}
