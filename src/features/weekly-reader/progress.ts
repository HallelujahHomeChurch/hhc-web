import {useCallback, useEffect, useRef} from 'react';
import type {BulletinReaderMutation, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {readerSentences} from './selection';

export function useReaderProgress(document: MemberOnlineDocument, commit: (mutation: BulletinReaderMutation) => Promise<unknown>) {
  const pending = useRef<BulletinReaderMutation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = useRef(commit);
  useEffect(() => {send.current = commit;}, [commit]);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const mutation = pending.current;
    pending.current = null;
    if (mutation) await send.current(mutation).catch(() => {}); // The private-state boundary displays sync failure.
  }, []);
  useEffect(() => {
    const hide = () => {if (globalThis.document.visibilityState === 'hidden') void flush();};
    globalThis.document.addEventListener('visibilitychange', hide);
    return () => {globalThis.document.removeEventListener('visibilitychange', hide); if (timer.current) clearTimeout(timer.current);};
  }, [flush]);
  const record = useCallback((pageId: string, preferredSentence?: string) => {
    const layout = document.content.layoutManifest.pages.find(page => page.pageId === pageId);
    if (!layout) return;
    const ids = [...(layout.fixedSlots ?? []).map(slot => `canonical-${slot.element}`), ...layout.slots.flatMap(slot => slot.fragments.map(fragment => fragment.sentenceId))];
    const sentences = readerSentences(document);
    const sentence = sentences.find(sentence => sentence.id === preferredSentence && ids.includes(sentence.id)) ?? sentences.find(sentence => ids.includes(sentence.id));
    pending.current = {mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: document.revision, kind: 'setProgress', payload: {pageId, componentId: sentence?.componentId ?? '', sentenceId: sentence?.id ?? ''}};
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 500);
  }, [document, flush]);
  async function reset() {
    if (timer.current) clearTimeout(timer.current); pending.current = null;
    await send.current({mutationId: crypto.randomUUID(), createdAt: new Date().toISOString(), documentRevision: document.revision, kind: 'setProgress', payload: {}});
  }
  return {record, flush, reset};
}
