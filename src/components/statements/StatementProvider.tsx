'use client';
import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {createHhcWebClient, type ActiveStatement, type PublicContentItem} from '@hallelujahhomechurch/hhc-web-client';
import type {Locale} from '@/i18n/locales';
import {hiddenDayKey, statementIsActive, taipeiDay} from '@/features/statements/visibility';
import {StatementDialog, type StatementLabels} from './StatementDialog';

// Document lifetime survives SPA route and locale-layout remounts, but not reloads.
const prompted = new Set<string>();
const Context = createContext<{statement: PublicContentItem | null; labels: StatementLabels} | null>(null);
export const useStatement = () => useContext(Context);
const isTyping = () => document.activeElement instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);

export function StatementProvider({children, locale, labels}: {children: ReactNode; locale: Locale; labels: StatementLabels}) {
  const pathname = usePathname();
  const [active, setActive] = useState<ActiveStatement | null>(null);
  const [open, setOpen] = useState(false);
  const [reevaluate, setReevaluate] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const client = createHhcWebClient({baseUrl: `${window.location.origin}/api`, getAccessToken: () => null});
    let pending = false;
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        const result = await client.getActiveStatement(locale, controller.signal);
        if (controller.signal.aborted) return;
        offset.current = Date.parse(result.serverNow) - Date.now();
        setActive({...result, statement: result.statement && statementIsActive(result.statement, Date.parse(result.serverNow)) ? result.statement : null});
        clearTimeout(boundaryTimer);
        if (result.nextChangeAt) boundaryTimer = setTimeout(() => {
          setActive(null);
          void refresh();
        }, Math.min(2_147_483_647, Math.max(0, Date.parse(result.nextChangeAt) - Date.parse(result.serverNow))));
      } catch {
        if (!controller.signal.aborted) setActive(null);
      } finally {pending = false;}
    }
    const visibleRefresh = () => {if (document.visibilityState === 'visible') void refresh();};
    const recheck = () => setReevaluate((value) => value + 1);
    void refresh();
    const interval = setInterval(visibleRefresh, 60_000);
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    window.addEventListener('storage', recheck);
    document.addEventListener('focusout', recheck);
    return () => {
      controller.abort(); clearInterval(interval); clearTimeout(boundaryTimer);
      window.removeEventListener('focus', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
      window.removeEventListener('storage', recheck);
      document.removeEventListener('focusout', recheck);
    };
  }, [locale]);
  const statement = active?.statement ?? null;
  /* eslint-disable react-hooks/set-state-in-effect -- Synchronize document prompt state with external storage and route entry. */
  useEffect(() => {
    if (!statement || !statementIsActive(statement, Date.now() + offset.current)) {setOpen(false); return;}
    // Fallback content keeps its published locale in href; the shared URL may use another locale.
    const articlePath = (value?: string | null) => value?.replace(/^\/[^/]+/, '').replace(/\/$/, '');
    if (articlePath(pathname) === articlePath(statement.href)) {prompted.add(statement.id); setOpen(false); return;}
    let hidden = false;
    try {hidden = localStorage.getItem(hiddenDayKey(statement.id)) === taipeiDay(Date.now() + offset.current);} catch { /* Storage restrictions must not prevent reading. */ }
    if (hidden) {setOpen(false); return;}
    if (!prompted.has(statement.id) && !isTyping()) {prompted.add(statement.id); setOpen(true);}
  }, [statement, pathname, reevaluate]);
  /* eslint-enable react-hooks/set-state-in-effect */
  function close(hideToday: boolean) {
    if (statement && hideToday) {
      try {localStorage.setItem(hiddenDayKey(statement.id), taipeiDay(Date.now() + offset.current)); prompted.delete(statement.id);} catch { /* Ordinary document dismissal remains available. */ }
    }
    setOpen(false);
  }
  return <Context.Provider value={{statement, labels}}>{children}{open && statement ? <StatementDialog key={statement.id} statement={statement} labels={labels} onClose={close} /> : null}</Context.Provider>;
}
