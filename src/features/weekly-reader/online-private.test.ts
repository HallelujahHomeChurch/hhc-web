import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
const now=Date.parse('2026-10-02T00:00:00Z');
const selector={accountId:'account-a',issueNumber:1739,series:'general' as const,contentLocale:'zh-Hant' as const};
const value=readerFixture();
const note={id:'n',text:'A',quote:'內容0。',sentenceIds:['s0'],inactiveAnchors:[],version:1,deleted:false,reanchorRequired:false,createdAt:'',updatedAt:''};
const state:BulletinReaderState={accountId:selector.accountId,documentId:value.document.documentId,appliedRevision:1,currentRevision:1,highlights:[],notes:[note],progress:null,conflicts:[]};
const edit=(id:string,text:string,version:number):BulletinReaderMutation=>({mutationId:id,createdAt:new Date(now).toISOString(),documentRevision:1,kind:'editNote',baseVersion:version,payload:{noteId:note.id,text}});
let store:typeof import('./offline-store');
beforeEach(async()=>{
  vi.resetModules();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);
  vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('crypto',webcrypto);
  vi.stubGlobal('navigator',{locks:{request:async(_name:string,work:()=>Promise<unknown>)=>work()}});
  store=await import('./offline-store');
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
async function seed(){const epoch=await store.activateOfflineAccount(selector.accountId);await store.bindOnlinePrivate(selector,value,epoch,now);await store.seedPrivateReplica(selector,state,epoch,now);return epoch;}
async function rows(name:string){const request=indexedDB.open('hhc-weekly-reader',2);const db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result);});try{return await new Promise<unknown[]>(resolve=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);});}finally{db.close();}}
it('stores private intents with minimal binding and never manufactures an OfflineSave',async()=>{
  const epoch=await seed();await store.enqueuePrivateMutation(selector,edit('a','B',1),epoch,now);
  expect(await rows('documents')).toEqual([]);expect(await store.readOfflineSave(selector,now)).toBeNull();expect(await store.listOfflineSaves(selector.accountId)).toEqual([]);
  const checks=JSON.stringify(await rows('checks'));expect(checks).not.toContain('components');expect(checks).not.toContain('resources');expect(checks).toContain('onlineOnly');
  expect((await store.readPrivateReplica(selector,now))?.state.notes[0].text).toBe('B');
});
it('requires fresh runtime authorization after a cold tab, then restores the same queue',async()=>{
  const epoch=await seed();const intent=edit('a','B',1);await store.enqueuePrivateMutation(selector,intent,epoch,now);
  vi.resetModules();store=await import('./offline-store');
  await expect(store.readPrivateReplica(selector,now)).rejects.toThrow('online_revalidation_required');
  await store.bindOnlinePrivate(selector,value,epoch,now);
  expect((await store.readPrivateReplica(selector,now))?.queue[0].mutation).toEqual(intent);
});
it('replays later local edits after a late acknowledgement without overwriting their text or CAS',async()=>{
  const epoch=await seed(),a=edit('a','B',1),b=edit('b','C',2);
  await store.enqueuePrivateMutation(selector,a,epoch,now);await store.claimPrivateMutation(selector,epoch,now);
  await store.enqueuePrivateMutation(selector,b,epoch,now);
  const next=await store.acknowledgePrivateMutation(selector,{state:{...state,notes:[{...note,text:'B',version:2}]},results:[{mutationId:'a',status:'applied',revision:1}]},epoch,now);
  expect(next.state.notes[0]).toMatchObject({text:'C',version:3});expect(next.queue.map(entry=>entry.mutation)).toEqual([b]);
});
it('does not extend the same receipt and isolates expired or changed owners',async()=>{
  const epoch=await seed();await store.bindOnlinePrivate(selector,value,epoch,now+1000);
  await expect(store.readPrivateReplica(selector,Date.parse(value.access.offlineValidUntil))).rejects.toThrow('offline_access_expired');
  await store.activateOfflineAccount('account-b');await expect(store.readPrivateReplica(selector,now)).rejects.toThrow('offline_account_changed');expect(await rows('private')).toEqual([]);
});
it('retains an old journal for explicit recovery on revision change without replay or content download',async()=>{
  const epoch=await seed();await store.enqueuePrivateMutation(selector,edit('a','B',1),epoch,now);
  const current={...structuredClone(value),document:{...value.document,revision:2},access:{...value.access,receiptId:'new',revision:2,currentRevision:2,validatedAt:new Date(now+1000).toISOString(),offlineValidUntil:new Date(now+1000+604800000).toISOString()}};
  await store.bindOnlinePrivate(selector,current,epoch,now+1000);
  expect(await store.readPrivateBinding(selector,now+1000)).toMatchObject({revision:1,onlineOnly:true,writable:false});
  expect(await store.claimPrivateMutation(selector,epoch,now+1000)).toBeNull();expect(await rows('documents')).toEqual([]);
});

it('commits an explicit online-only recovery without fetching resources or replacing a changed queue',async()=>{
  const epoch=await seed();await store.enqueuePrivateMutation(selector,edit('old','B',1),epoch,now);
  const current={...structuredClone(value),document:{...value.document,revision:2},access:{...value.access,receiptId:'new',revision:2,currentRevision:2,validatedAt:new Date(now+1000).toISOString(),offlineValidUntil:new Date(now+1000+604800000).toISOString()}};
  await store.bindOnlinePrivate(selector,current,epoch,now+1000);
  const original=(await store.readPrivateReplica(selector,now+1000))!;
  const resolved=await store.chooseReaderRecovery(selector,'old',null,epoch,original.queue,now+1000);
  const cloud={...state,currentRevision:2,appliedRevision:2};
  await expect(store.commitOnlineUpgrade(selector,current,cloud,epoch,1,original.queue,now+1000)).rejects.toThrow('offline_replica_changed');
  await store.commitOnlineUpgrade(selector,current,cloud,epoch,1,resolved,now+1000);
  expect(await store.readPrivateBinding(selector,now+1000)).toMatchObject({revision:2,onlineOnly:true,writable:true,replica:{queue:[]}});
  expect(await rows('documents')).toEqual([]);expect(await store.readOfflineSave(selector,now+1000)).toBeNull();
});

it('refuses ordinary offline download pointer changes while an earlier online-only journal is pending',async()=>{
  const epoch=await seed();const intent=edit('keep-old','B',1);await store.enqueuePrivateMutation(selector,intent,epoch,now);
  const current={...structuredClone(value),document:{...value.document,revision:2},access:{...value.access,receiptId:'new',revision:2,currentRevision:2,validatedAt:new Date(now+1000).toISOString(),offlineValidUntil:new Date(now+1000+604800000).toISOString()}};
  await store.bindOnlinePrivate(selector,current,epoch,now+1000);
  const before=await store.readPrivateBinding(selector,now+1000);
  await expect(store.commitOfflineSave({selector,value:current,epoch,resources:[],size:100,locked:false,lastObservedAt:now+1000},epoch,now+1000)).rejects.toThrow('offline_pending_recovery');
  expect(await store.readPrivateBinding(selector,now+1000)).toEqual(before);expect((await store.readPrivateReplica(selector,now+1000))?.queue[0].mutation).toEqual(intent);
  expect(await store.readOfflineSave(selector,now+1000)).toBeNull();expect(await rows('documents')).toEqual([]);
});
it('allows a same-revision explicit offline save without removing its online-only queue',async()=>{
  const epoch=await seed();const intent=edit('keep-same','B',1);await store.enqueuePrivateMutation(selector,intent,epoch,now);
  await store.commitOfflineSave({selector,value,epoch,resources:[],size:100,locked:false,lastObservedAt:now},epoch,now);
  expect((await store.readPrivateReplica(selector,now))?.queue[0].mutation).toEqual(intent);expect((await store.readOfflineSave(selector,now))?.status).toBe('available');
});
