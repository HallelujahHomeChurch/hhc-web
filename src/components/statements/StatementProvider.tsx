'use client';
import {createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {createHhcWebClient, type ActiveStatement, type PublicContentItem} from '@hallelujahhomechurch/hhc-web-client';
import {readAnonymousStatementDismissal, writeAnonymousStatementDismissal, statementRefKey} from '@hallelujahhomechurch/preferences';
import {useAccountAuth, useBulletinAuthorization} from '@/components/layout/AccountControl';
import type {Locale} from '@/i18n/locales';
import {isStatementSuppressedPath, statementIsActive} from '@/features/statements/visibility';
import {StatementDialog, type StatementLabels} from './StatementDialog';
import {captureHandledError} from '@/lib/observability';

// Document lifetime survives SPA route and locale-layout remounts, but not reloads.
const prompted = new Set<string>();
const Context = createContext<{statement: PublicContentItem | null; labels: StatementLabels} | null>(null);
export const useStatement = () => useContext(Context);
const isTyping = () => document.activeElement instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);

export function StatementProvider({children, locale, labels}: {children: ReactNode; locale: Locale; labels: StatementLabels}) {
  const auth = useAccountAuth();
  const authorization = useBulletinAuthorization();
  const subject = auth.status === 'authenticated' ? auth.session.user.id : auth.status === 'anonymous' ? 'anonymous' : null;
  const pathname = usePathname();
  const statementsSuppressed = isStatementSuppressedPath(pathname ?? '');
  const [active, setActive] = useState<ActiveStatement | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [preference, setPreference] = useState<{key: string; hidden: boolean} | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const scope = useRef<{controller: AbortController; client: ReturnType<typeof createHhcWebClient>; subject: string | null; key?: string | null} | null>(null);
  const [reevaluate, setReevaluate] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    if (statementsSuppressed) return;
    const controller = new AbortController();
    const client = createHhcWebClient({baseUrl: `${window.location.origin}/api`, ...authorization});
    scope.current = {controller, client, subject, key: scope.current?.subject === subject ? scope.current.key : null};
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
        const item = result.statement;
        if (subject && item) {
          const ref = {statementId: item.id, publishedVersion: item.publishedVersion ?? 0};
          const key = `${subject}:${statementRefKey(ref)}`;
          try {
            const hidden = subject === 'anonymous' ? readAnonymousStatementDismissal(ref) : (await client.getStatementDismissal(ref, controller.signal)).dismissed;
            if (!controller.signal.aborted) setPreference({key, hidden});
          } catch (error) {
            if (!controller.signal.aborted) {
              captureHandledError(error, {operation: 'statement.dismissal.read', tags: {locale}});
              setPreference({key, hidden: true});
            }
          }
        }
        clearTimeout(boundaryTimer);
        if (result.nextChangeAt) boundaryTimer = setTimeout(() => {
          setActive(null);
          void refresh();
        }, Math.min(2_147_483_647, Math.max(0, Date.parse(result.nextChangeAt) - Date.parse(result.serverNow))));
      } catch (error) {
        if (!controller.signal.aborted) {
          captureHandledError(error, {operation: 'statement.active', tags: {locale}});
          setActive(null);
        }
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
  }, [locale, statementsSuppressed, subject, authorization]);
  const statement = statementsSuppressed ? null : active?.statement ?? null;
  const ref = useMemo(() => statement ? {statementId: statement.id, publishedVersion: statement.publishedVersion ?? 0} : null, [statement]);
  const key = subject && ref && Number.isSafeInteger(ref.publishedVersion) && ref.publishedVersion > 0 ? `${subject}:${statementRefKey(ref)}` : null;
  const saving = savingKey === key && key !== null;
  useEffect(() => {if (scope.current) scope.current.key = key}, [key]);
  /* eslint-disable react-hooks/set-state-in-effect -- Synchronize document prompt state with external preferences and route entry. */
  useEffect(() => {
    if (!statement || !key || preference?.key !== key || preference.hidden || !statementIsActive(statement, Date.now() + offset.current)) {setOpenKey(null); return;}
    const articlePath = (value?: string | null) => value?.replace(/^\/[^/]+/, '').replace(/\/$/, '');
    if (articlePath(pathname) === articlePath(statement.href)) {prompted.add(key); setOpenKey(null); return;}
    if (subject === 'anonymous' && ref && readAnonymousStatementDismissal(ref)) {setOpenKey(null); return;}
    if (!prompted.has(key) && !isTyping()) {prompted.add(key); setOpenKey(key);}
  }, [statement, key, preference, pathname, reevaluate, subject, ref]);
  /* eslint-enable react-hooks/set-state-in-effect */
  async function close(hide: boolean) {
    if (saving || !ref || !key) return;
    const current = scope.current;
    setErrorKey(null);
    if (hide) {
      setSavingKey(key);
      try {
        if (subject === 'anonymous') {
          if (!writeAnonymousStatementDismissal(ref)) throw new Error('Statement preference storage unavailable');
        } else {
          if (!current || current.subject !== subject) return;
          await current.client.dismissStatement(ref, current.controller.signal);
        }
      } catch (error) {
        if (current?.controller.signal.aborted || scope.current !== current || current?.key !== key) return;
        captureHandledError(error, {operation: 'statement.dismissal.write', tags: {locale}});
        setErrorKey(key);
      } finally {
        setSavingKey(value => value === key ? null : value);
      }
    }
    if (!current?.controller.signal.aborted && scope.current === current && current?.key === key) setOpenKey(null);
  }
  return <Context.Provider value={{statement, labels}}>{children}{errorKey === key && key ? <p role="status">{labels.syncError}</p> : null}{openKey === key && key && statement ? <StatementDialog key={key} statement={statement} labels={labels} saving={saving} onClose={close} /> : null}</Context.Provider>;
}
