'use client';
import {NotificationBell as SharedNotificationBell} from '@hallelujahhomechurch/ui';
import {useRouter} from 'next/navigation';
import {useNotificationInbox, useNotificationPresentation} from './provider';
export function NotificationBell() {
  const inbox = useNotificationInbox();
  return inbox?.enabled ? <ActiveBell/> : null;
}
function ActiveBell() {
  const {inbox,state,props}=useNotificationPresentation('summary');
  const router=useRouter();
  if (!inbox?.enabled || !state) return null;
  return <SharedNotificationBell {...props} unreadCount={state.summary.status==='ready'?state.summary.data.unreadCount:null} isOpen={state.open} onOpenChange={inbox.store.setOpen} viewAllLink={{href:`/${inbox.locale}/notifications`,label:props.labels.viewAll}} onNavigate={(href,id)=>{if(id)void inbox.store.markRead(id);inbox.store.setOpen(false);router.push(href);}}/>;
}
