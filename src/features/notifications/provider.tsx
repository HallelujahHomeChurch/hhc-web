'use client';
import {createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode} from 'react';
import {createInboxClient} from '@hallelujahhomechurch/account-client';
import {Toast, type NotificationLabels, type NotificationListState} from '@hallelujahhomechurch/ui';
import {useTranslations} from 'next-intl';
import {useAccountAuth, useInboxAuthRuntime} from '@/components/layout/AccountControl';
import type {Locale} from '@/i18n/locales';
import {createNotificationStore} from './state';
import {notificationItem} from './api';

type Store = ReturnType<typeof createNotificationStore>;
const Context = createContext<{store:Store;locale:Locale;enabled:boolean} | null>(null);
export function NotificationProvider({locale, children}: {locale:Locale;children:ReactNode}) {
  const auth = useInboxAuthRuntime();
  const account = useAccountAuth();
  const t = useTranslations('site.inbox');
  const store = useMemo(() => auth ? createNotificationStore({client:createInboxClient({auth}),auth,locale}) : null,[auth,locale]);
  useEffect(() => store?.start(),[store]);
  const enabled = account.status === 'authenticated' && account.session.permissionAvailability.status === 'available';
  if (!store) return children;
  return <Context.Provider value={{store,locale,enabled}}>{children}<NotificationError store={store} message={t('actionError')}/></Context.Provider>;
}
function NotificationError({store,message}:{store:Store;message:string}) {
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return state.actionError ? <div className="fixed bottom-24 right-4 z-50 max-w-[min(360px,calc(100vw-32px))]"><Toast tone="danger">{message}</Toast></div> : null;
}
/** Future group mutations call store.invalidate() to invalidate current inbox visibility. */
export function useNotificationInbox() {return useContext(Context);}
export function useNotificationPresentation(source:'summary'|'page') {
  const inbox=useNotificationInbox();
  const t=useTranslations('site.inbox');
  const store=inbox?.store;
  const state=useSyncExternalStore(store?.subscribe ?? emptySubscribe,store?.getSnapshot ?? emptySnapshot,store?.getSnapshot ?? emptySnapshot);
  const labels:NotificationLabels={title:t('title'),loading:t('loading'),empty:t('empty'),retry:t('retry'),markRead:t('markRead'),markAllRead:t('markAllRead'),unread:t('unread'),read:t('read'),viewAll:t('viewAll'),count:count=>count===null?t('countUnavailable'):t('count',{count})};
  const remote=state?.[source];
  const presentation:NotificationListState = !remote || remote.status==='loading'?{status:'loading'}:remote.status==='error'?{status:'error',message:t('loadError')}:{status:'ready',items:remote.data.items.map(item=>notificationItem(item,inbox!.locale,{generic:t('generic'),published:t('published'),open:t('open')}))};
  return {inbox,state,labels,presentation,t,props:{state:presentation,labels,onRetry:()=>void store?.refresh(true),onMarkRead:(id:string)=>void store?.markRead(id),markingReadIds:state?.markingReadIds,onMarkAllRead:()=>void store?.markAllRead(source),isMarkingAllRead:state?.markingAll,isMarkAllReadDisabled:remote?.status!=='ready'||(source==='summary'&&state?.summary.status==='ready'&&state.summary.data.unreadCount===0)}};
}
const emptySubscribe=()=>()=>{};
const emptySnapshot=()=>null;
