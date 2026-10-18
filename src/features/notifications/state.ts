import {AccountSessionError, type InboxClient, type InboxClientOptions, type InboxPage, type InboxSummary, type InboxLocale} from '@hallelujahhomechurch/account-client';
export type Remote<T> = {status: 'loading'} | {status: 'error'} | {status: 'ready'; data: T};
export interface NotificationState {
  summary: Remote<InboxSummary>; page: Remote<InboxPage>; open: boolean;
  filter: 'all' | 'unread'; hasPrevious: boolean; markingReadIds: string[]; markingAll: boolean; actionError: boolean;
}
/** Private data and opaque pagination/snapshot tokens live only in this mounted store. */
export function createNotificationStore({client, auth, locale}: {client: InboxClient; auth: InboxClientOptions['auth']; locale: InboxLocale}) {
  const empty = (): NotificationState => ({summary: {status: 'loading'}, page: {status: 'loading'}, open: false, filter: 'all', hasPrevious: false, markingReadIds: [], markingAll: false, actionError: false});
  let state = empty(), generation = 0, pageMounted = false, cursor: string | undefined;
  let back: (string | undefined)[] = [];
  const authKey = () => {
    const current = auth.getSnapshot();
    return current.status === 'authenticated' ? JSON.stringify([current.status, current.session.user, [...current.session.permissions].sort(), current.session.permissionAvailability]) : current.status;
  };
  let lastRefresh = -Infinity, lastAuth = authKey();
  let timer: ReturnType<typeof setInterval> | undefined;
  let focusTimer: ReturnType<typeof setTimeout> | undefined;
  const readControllers = new Map<'summary'|'page', AbortController>();
  const listeners = new Set<() => void>(), controllers = new Set<AbortController>();
  const pending = new Map<'summary'|'page', Promise<void>>();
  const publish = (patch: Partial<NotificationState>) => {state = {...state, ...patch}; listeners.forEach(listener => listener());};
  const allowed = () => {const s = auth.getSnapshot(); return s.status === 'authenticated' && s.session.permissionAvailability.status === 'available';};
  const visible = () => document.visibilityState === 'visible';
  function cancel() {
    generation++; controllers.forEach(controller => controller.abort()); controllers.clear(); pending.clear(); readControllers.clear();
  }
  function reset() {cancel(); cursor = undefined; back = []; state = empty(); listeners.forEach(listener => listener());}
  async function load(kind: 'summary'|'page'): Promise<void> {
    if (!allowed() || !visible()) return;
    const existing = pending.get(kind); if (existing) return existing;
    const controller = new AbortController(), version = generation;
    controllers.add(controller); readControllers.set(kind, controller);
    publish({[kind]: {status: 'loading'}});
    const request = (async () => {
      try {
        const data = kind === 'summary' ? await client.summary({locale, signal: controller.signal}) : await client.list({locale, filter: state.filter, cursor, limit: 20, signal: controller.signal});
        if (!controller.signal.aborted && version === generation && allowed()) publish(kind === 'summary' ? {summary: {status:'ready', data: data as InboxSummary}} : {page: {status:'ready', data: data as InboxPage}});
      } catch (error) {
        if (!controller.signal.aborted && version === generation) {
          const denied = kind === 'page' && error instanceof AccountSessionError && [401,403,503].includes(error.status);
          publish(denied ? {page:{status:'error'},summary:{status:'error'}} : {[kind]:{status:'error'}});
        }
      } finally {controllers.delete(controller);if (readControllers.get(kind) === controller) readControllers.delete(kind);}
    })();
    pending.set(kind, request);
    void request.finally(() => {if (pending.get(kind) === request) pending.delete(kind);});
    return request;
  }
  async function refresh(force = false) {
    if (!allowed() || !visible()) return;
    if (!force && Date.now() - lastRefresh < 500) {await Promise.all([...pending.values()]); return;}
    lastRefresh = Date.now();
    await Promise.all([load('summary'), ...(pageMounted ? [load('page')] : [])]);
  }
  function invalidate() {
    readControllers.forEach(controller => controller.abort());readControllers.clear();pending.clear();
    publish({summary:{status:'loading'},page:{status:'loading'}});
    return refresh(true);
  }
  function syncTimer() {
    if (timer) clearInterval(timer); timer = undefined;
    if (allowed() && visible()) timer = setInterval(() => {void refresh();}, 60_000);
  }
  function cancelPage() {readControllers.get('page')?.abort();readControllers.delete('page');pending.delete('page');}
  function changePage() {
    cancelPage();
    publish({page:{status:'loading'}, hasPrevious:back.length > 0});
    void load('page');
  }
  async function mutate(id?: string, source: 'summary'|'page' = 'summary') {
    if (!allowed() || state.markingAll || id && state.markingReadIds.includes(id)) return;
    const current = state[source];
    const snapshot = current.status === 'ready' ? current.data.readSnapshotToken : undefined;
    if (!id && !snapshot) return;
    const controller = new AbortController(), version = generation;
    controllers.add(controller);
    publish({actionError:false, ...(id ? {markingReadIds:[...state.markingReadIds, id]} : {markingAll:true})});
    try {
      if (id) await client.markRead(id, controller.signal); else await client.markAllRead(snapshot!, controller.signal);
      if (version === generation && !controller.signal.aborted) {
        await invalidate();
      }
    } catch (error) {
      if (version !== generation || controller.signal.aborted) return;
      const denied = error instanceof AccountSessionError && [401,403,503].includes(error.status);
      if (denied) {cancel(); publish({summary:{status:'error'},page:{status:'error'},open:false,markingReadIds:[],markingAll:false});}
      publish({actionError:true});
      // A failed watermark is never replayed with a newer, wider snapshot.
      if (!id && !denied) await invalidate();
    } finally {
      controllers.delete(controller);
      if (version === generation) publish(id ? {markingReadIds:state.markingReadIds.filter(value => value !== id)} : {markingAll:false});
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    start() {
      const unsubscribe = auth.subscribe(() => {
        const next = authKey(); if (next === lastAuth) return;
        lastAuth = next; reset(); syncTimer(); void refresh(true);
      });
      const focus = () => {clearTimeout(focusTimer);focusTimer = setTimeout(() => {void refresh();},100);};
      const visibility = () => {
        syncTimer();
        if (visible()) void refresh();
        else {lastRefresh = -Infinity;void invalidate();publish({open:false});}
      };
      window.addEventListener('focus',focus); document.addEventListener('visibilitychange',visibility);
      syncTimer();void refresh(true);
      return () => {unsubscribe();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);clearInterval(timer);clearTimeout(focusTimer);reset();};
    },
    refresh,
    invalidate,
    setOpen(open: boolean) {publish({open: open && allowed()}); if (open) void refresh();},
    mountPage() {pageMounted = true;void load('page');return () => {pageMounted = false;cursor = undefined;back = [];cancelPage();publish({page:{status:'loading'},hasPrevious:false});};},
    setFilter(filter: 'all'|'unread') {if (filter === state.filter) return;cursor = undefined;back = [];publish({filter});changePage();},
    // shortcut: keep the last 64 cursor-only pages; increase only if deeper back navigation is needed.
    next() {if (state.page.status !== 'ready' || !state.page.data.nextCursor) return;back = [...back.slice(-63),cursor];cursor = state.page.data.nextCursor;changePage();},
    previous() {if (!back.length) return;cursor = back.pop();changePage();},
    markRead: (id: string) => mutate(id),
    markAllRead: (source: 'summary'|'page') => mutate(undefined, source)
  };
}
