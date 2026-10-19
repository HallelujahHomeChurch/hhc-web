import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {AccountSessionError} from '@hallelujahhomechurch/account-client';
import type {AccountAuthState, InboxClient, InboxSummary, InboxPage, InboxItem} from '@hallelujahhomechurch/account-client';
import {createNotificationStore} from './state';
const item: InboxItem = {id: '11111111-1111-4111-8111-111111111111', type: 'recording.published', resource: {type: 'recording', id: 'video1'}, occurredAt: '2026-10-19T00:00:00Z', projection: {titleKey:'notification.recording', messageKey:'notification.published', parameters:{title:'Private recording'}}};
const summary: InboxSummary = {items:[item], unreadCount:105, readSnapshotToken:'captured-summary', asOf:item.occurredAt};
const page: InboxPage = {items:[item], readSnapshotToken:'captured-page', nextCursor:'opaque-next', asOf:item.occurredAt};
function harness() {
  let snapshot: AccountAuthState = {status:'authenticated', session:{user:{id:'owner',email:'synthetic@example.test',display_name:'Synthetic',avatar_url:null},permissions:[],permissionAvailability:{status:'available'}}};
  const listeners = new Set<() => void>();
  const auth = {getSnapshot:()=>snapshot, subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};}, getAccessToken:async()=> 'synthetic', refreshAfterUnauthorized:async()=> 'synthetic'};
  const client: InboxClient = {summary:vi.fn().mockResolvedValue(summary), list:vi.fn().mockResolvedValue(page), markRead:vi.fn().mockResolvedValue({read:true}), markAllRead:vi.fn().mockResolvedValue({read:true})};
  const store = createNotificationStore({client,auth,locale:'en'});
  const stop = store.start(); cleanups.push(stop);
  return {store,client,change(next:AccountAuthState){snapshot=next;listeners.forEach(fn=>fn());},sameActor(changed=false){snapshot=snapshot.status==='authenticated'?{...snapshot,session:{...snapshot.session,permissions:changed?['changed.permission']:snapshot.session.permissions}}:{...snapshot};listeners.forEach(fn=>fn());}};
}
const cleanups: (()=>void)[] = [];
const flush=async()=>{await vi.advanceTimersByTimeAsync(0);};
beforeEach(()=>{vi.useFakeTimers(); Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});});
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());vi.useRealTimers();});
it('polls the closed Bell once every foreground minute, deduplicates focus/open, and stops in background',async()=>{
 const {store,client}=harness(); await flush(); expect(client.summary).toHaveBeenCalledTimes(1);
 expect(store.getSnapshot().summary).toEqual({status:'ready',data:summary});
 store.setOpen(true); window.dispatchEvent(new Event('focus')); await flush(); expect(client.summary).toHaveBeenCalledTimes(1);
 store.setOpen(false); await vi.advanceTimersByTimeAsync(60_000); expect(client.summary).toHaveBeenCalledTimes(2);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(120_000);expect(client.summary).toHaveBeenCalledTimes(2);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));await flush();expect(client.summary).toHaveBeenCalledTimes(3);
});
it('loads page independently of failed summary and refetches only the current cursor on visibility refresh',async()=>{
 const {store,client}=harness();await flush();vi.mocked(client.summary).mockRejectedValue(new Error('unavailable'));const stop=store.mountPage();cleanups.push(stop);await store.refresh(true);await flush();
 expect(store.getSnapshot().summary.status).toBe('error'); expect(store.getSnapshot().page.status).toBe('ready');
 store.next();await flush();expect(client.list).toHaveBeenLastCalledWith(expect.objectContaining({cursor:'opaque-next',filter:'all',limit:20,locale:'en'}));
 await vi.advanceTimersByTimeAsync(60_000);expect(client.list).toHaveBeenCalledTimes(3);
 store.setFilter('unread');await flush();expect(client.list).toHaveBeenLastCalledWith(expect.objectContaining({cursor:undefined,filter:'unread'}));expect(store.getSnapshot().hasPrevious).toBe(false);
});
it('captures the original read-all snapshot without widening during refresh or expired-token recovery',async()=>{
 const {store,client}=harness();await flush();let reject!:(error:Error)=>void;
 vi.mocked(client.markAllRead).mockImplementation(()=>new Promise((_r,j)=>{reject=j;}));
 const pending=store.markAllRead('summary');await flush();vi.mocked(client.summary).mockResolvedValue({...summary,readSnapshotToken:'newer'});await store.refresh(true);reject(new Error('expired'));await pending;await flush();
 expect(client.markAllRead).toHaveBeenCalledTimes(1);expect(client.markAllRead).toHaveBeenCalledWith('captured-summary',expect.any(AbortSignal));expect(store.getSnapshot().actionError).toBe(true);
});
it('failed mark-read preserves the persisted count and gives a generic recoverable error',async()=>{
 const {store,client}=harness();await flush();vi.mocked(client.markRead).mockRejectedValue(new Error('private provider failure'));await store.markRead(item.id);
 expect(store.getSnapshot().actionError).toBe(true);expect(store.getSnapshot().summary).toEqual({status:'ready',data:summary});
});
it('auth loss aborts and fences late private responses, also across same-actor session changes',async()=>{
 const {store,client,change,sameActor}=harness();await flush();let resolve!:(data:InboxSummary)=>void;
 vi.mocked(client.summary).mockImplementation(()=>new Promise(r=>{resolve=r;}));const pending=store.refresh(true);await flush();const signal=vi.mocked(client.summary).mock.lastCall?.[0]?.signal;
 change({status:'anonymous'});expect(signal?.aborted).toBe(true);resolve(summary);await pending;expect(store.getSnapshot().summary.status).not.toBe('ready');expect(store.getSnapshot().open).toBe(false);
 sameActor(); await vi.advanceTimersByTimeAsync(60_000);expect(client.summary).toHaveBeenCalledTimes(2);
});
it('same actor revalidation clears private page/summary before refetch; failures cannot expose stale titles',async()=>{
 const {store,client,sameActor}=harness();cleanups.push(store.mountPage());await flush();vi.mocked(client.summary).mockRejectedValue(new Error('503'));vi.mocked(client.list).mockRejectedValue(new Error('403'));
 sameActor(true);expect(store.getSnapshot().summary.status).not.toBe('ready');expect(store.getSnapshot().page.status).not.toBe('ready');await flush();expect(store.getSnapshot().page.status).toBe('error');expect(store.getSnapshot().summary.status).toBe('error');
});
it('does not fetch during construction and cleanup/remount leaves one timer and fences the first mount',async()=>{
 let state:AccountAuthState={status:'authenticated',session:{user:{id:'owner',email:'synthetic@example.test',display_name:'Synthetic',avatar_url:null},permissions:[],permissionAvailability:{status:'available'}}};
 const subscriptions=new Set<()=>void>();const client:InboxClient={summary:vi.fn().mockResolvedValue(summary),list:vi.fn().mockResolvedValue(page),markRead:vi.fn(),markAllRead:vi.fn()};
 const auth={getSnapshot:()=>state,subscribe:(fn:()=>void)=>{subscriptions.add(fn);return()=>{subscriptions.delete(fn);};},getAccessToken:async()=> 'test',refreshAfterUnauthorized:async()=> 'test'};
 const store=createNotificationStore({client,auth,locale:'en'});expect(client.summary).not.toHaveBeenCalled();expect(subscriptions.size).toBe(0);
 const stop=store.start();stop();const stopAgain=store.start();cleanups.push(stopAgain);await flush();expect(subscriptions.size).toBe(1);expect(client.summary).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(60_000);expect(client.summary).toHaveBeenCalledTimes(3);state={status:'anonymous'};subscriptions.forEach(fn=>fn());await vi.advanceTimersByTimeAsync(60_000);expect(client.summary).toHaveBeenCalledTimes(3);
});
it('refreshes immediately after a brief background interval without retaining private titles',async()=>{
 const {store,client}=harness();await flush();Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));expect(store.getSnapshot().summary.status).toBe('loading');
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));await flush();expect(client.summary).toHaveBeenCalledTimes(2);expect(store.getSnapshot().summary.status).toBe('ready');
});

it('keeps an open Bell through unchanged same-account session revalidation',async()=>{
 const {store,sameActor}=harness();await flush();store.setOpen(true);sameActor();expect(store.getSnapshot().open).toBe(true);expect(store.getSnapshot().summary.status).toBe('ready');
});
it('keeps the global read request alive across page unmount so navigation can retain a late generic failure',async()=>{
 const {store,client}=harness();const unmount=store.mountPage();await flush();let reject!:(error:Error)=>void;
 vi.mocked(client.markRead).mockImplementation(()=>new Promise((_resolve,fail)=>{reject=fail;}));const pending=store.markRead(item.id);await flush();const signal=vi.mocked(client.markRead).mock.lastCall?.[1];
 unmount();expect(signal?.aborted).toBe(false);reject(new Error('late failure'));await pending;expect(store.getSnapshot().actionError).toBe(true);
});

it('clears the preview when current page authority/dependency revalidation is denied',async()=>{
 const {store,client}=harness();await flush();vi.mocked(client.list).mockRejectedValue(new AccountSessionError(403,'NTF_FORBIDDEN'));cleanups.push(store.mountPage());await flush();expect(store.getSnapshot().page.status).toBe('error');expect(store.getSnapshot().summary.status).toBe('error');
});
it('still aborts and fences a navigation-surviving read when authentication is lost',async()=>{
 const {store,client,change}=harness();const unmount=store.mountPage();await flush();let reject!:(error:Error)=>void;
 vi.mocked(client.markRead).mockImplementation(()=>new Promise((_resolve,fail)=>{reject=fail;}));const pending=store.markRead(item.id);await flush();const signal=vi.mocked(client.markRead).mock.lastCall?.[1];
 unmount();change({status:'anonymous'});expect(signal?.aborted).toBe(true);reject(new Error('late private failure'));await pending;expect(store.getSnapshot().actionError).toBe(false);expect(store.getSnapshot().summary.status).not.toBe('ready');
});
it('invalidates pre-mutation reads before refreshing for future group actions',async()=>{
 const {store,client}=harness();await flush();let resolve!:(value:InboxSummary)=>void;
 vi.mocked(client.summary).mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({...summary,readSnapshotToken:'current-after-group-change',items:[]});
 const old=store.refresh(true);await flush();const oldSignal=vi.mocked(client.summary).mock.lastCall?.[0]?.signal;const refreshed=store.invalidate();expect(oldSignal?.aborted).toBe(true);resolve(summary);await old;await refreshed;expect(store.getSnapshot().summary).toEqual({status:'ready',data:{...summary,readSnapshotToken:'current-after-group-change',items:[]}});
});
it.each(['read','all'] as const)('external visibility invalidation preserves an unrelated global %s mutation',async(kind)=>{
 const {store,client}=harness();await flush();let complete!:(value:{read:true})=>void;
 if(kind==='read')vi.mocked(client.markRead).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));else vi.mocked(client.markAllRead).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
 const mutation=kind==='read'?store.markRead(item.id):store.markAllRead('summary');await flush();const signal=kind==='read'?vi.mocked(client.markRead).mock.lastCall?.[1]:vi.mocked(client.markAllRead).mock.lastCall?.[1];
 await store.invalidate();expect(signal?.aborted).toBe(false);expect(kind==='read'?store.getSnapshot().markingReadIds.includes(item.id):store.getSnapshot().markingAll).toBe(true);complete({read:true});await mutation;
});
it('suspends background reads without cancelling an already initiated read mutation',async()=>{
 const {store,client}=harness();await flush();let complete!:(value:{read:true})=>void;vi.mocked(client.markRead).mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));const mutation=store.markRead(item.id);await flush();const signal=vi.mocked(client.markRead).mock.lastCall?.[1];
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));expect(signal?.aborted).toBe(false);complete({read:true});await mutation;expect(store.getSnapshot().summary.status).toBe('loading');
});
it.each([[401,'read'],[401,'all'],[403,'read'],[403,'all'],[503,'read'],[503,'all']] as const)('fences late summaries after page %i while preserving a global %s mutation',async(status,kind)=>{
 const {store,client,change}=harness();await flush();let failMutation!:(error:Error)=>void;
 if(kind==='read')vi.mocked(client.markRead).mockImplementation(()=>new Promise((_resolve,reject)=>{failMutation=reject;}));else vi.mocked(client.markAllRead).mockImplementation(()=>new Promise((_resolve,reject)=>{failMutation=reject;}));
 const mutation=kind==='read'?store.markRead(item.id):store.markAllRead('summary');await flush();const mutationSignal=kind==='read'?vi.mocked(client.markRead).mock.lastCall?.[1]:vi.mocked(client.markAllRead).mock.lastCall?.[1];
 let finishOld!:(value:InboxSummary)=>void,finishNew!:(value:InboxSummary)=>void;
 vi.mocked(client.summary).mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{finishNew=resolve;}));
 const old=store.refresh(true);await flush();const oldSignal=vi.mocked(client.summary).mock.lastCall?.[0]?.signal;
 vi.mocked(client.list).mockRejectedValueOnce(new AccountSessionError(status,'NTF_DENIED'));cleanups.push(store.mountPage());await flush();
 expect(store.getSnapshot().summary.status).toBe('error');expect(oldSignal?.aborted).toBe(true);expect(mutationSignal?.aborted).toBe(false);
 expect(kind==='read'?store.getSnapshot().markingReadIds.includes(item.id):store.getSnapshot().markingAll).toBe(true);
 if(kind==='all')expect(client.markAllRead).toHaveBeenCalledWith('captured-summary',mutationSignal);
 const newer=store.refresh(true);await flush();const newerSignal=vi.mocked(client.summary).mock.lastCall?.[0]?.signal;
 finishOld(summary);await old;await flush();expect(store.getSnapshot().summary.status).toBe('loading');
 vi.mocked(client.list).mockRejectedValueOnce(new AccountSessionError(status,'NTF_DENIED'));store.setFilter('unread');await flush();
 expect(newerSignal?.aborted).toBe(true);finishNew(summary);await newer;expect(store.getSnapshot().summary.status).toBe('error');expect(mutationSignal?.aborted).toBe(false);
 change({status:'anonymous'});expect(mutationSignal?.aborted).toBe(true);failMutation(new Error('late failure'));await mutation;expect(store.getSnapshot().actionError).toBe(false);
});
