'use client';
import {useTranslations} from 'next-intl';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {Button, NotificationList} from '@hallelujahhomechurch/ui';
import {useAccountAuth, useAccountSignIn} from '@/components/layout/AccountControl';
import {useNotificationPresentation} from './provider';
export function NotificationsPage() {
  const {inbox,state,props,t}=useNotificationPresentation('page');
  const router=useRouter(),auth=useAccountAuth(),signIn=useAccountSignIn(),accountCopy=useTranslations('site.account');
  const store=inbox?.store;
  useEffect(()=>store?.mountPage(),[store]);
  return <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"><h1 className="mb-6 text-3xl font-semibold">{t('title')}</h1>
    {!inbox?.enabled ? <p role="status">{auth.status==='checking'?t('loading'):auth.status==='anonymous'?t('signInRequired'):t('loadError')}</p> : <>
      <div role="group" aria-label={t('title')} className="mb-6 flex flex-wrap gap-2"><Button variant={state?.filter==='all'?'primary':'secondary'} aria-pressed={state?.filter==='all'} onPress={()=>store?.setFilter('all')}>{t('all')}</Button><Button variant={state?.filter==='unread'?'primary':'secondary'} aria-pressed={state?.filter==='unread'} onPress={()=>store?.setFilter('unread')}>{t('unreadOnly')}</Button></div>
      <NotificationList {...props} onNavigate={(href,id)=>{if(id)void store?.markRead(id);router.push(href);}}/>
      <nav className="mt-6 flex justify-between gap-4" aria-label={t('title')}><Button variant="secondary" isDisabled={!state?.hasPrevious||state.page.status==='loading'} onPress={()=>store?.previous()}>{t('previous')}</Button><Button variant="secondary" isDisabled={state?.page.status!=='ready'||!state.page.data.nextCursor} onPress={()=>store?.next()}>{t('next')}</Button></nav>
    </>}
    {auth.status==='anonymous' ? <Button className="mt-4" onPress={()=>void signIn?.()}>{accountCopy('signIn')}</Button>:null}
  </section>;
}
