import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {BulletinReaderBookmark, BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {usePrivateReader} from './usePrivateReader';
import {readerFixture} from './test-fixture';
import {activateOfflineAccount, clearOfflineAccount, commitOfflineSave, seedPrivateReplica, enqueuePrivateMutation, readPrivateReplica, readBookmarkCache, mergeBookmarkCache} from './offline-store';
import {readReaderReturn} from './return-state';
const now=Date.parse('2026-10-02T00:00:00Z'),value=readerFixture(),selector={accountId:'account-a',issueNumber:1739,series:'general' as const,contentLocale:'zh-Hant' as const};
const bookmark:BulletinReaderBookmark={id:'bookmark-a',name:'My position',sentenceId:'s0',offset:1,pageId:'p0',documentRevision:1,version:1,deleted:false,reanchorRequired:false,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
const state:BulletinReaderState={accountId:'account-a',documentId:value.document.documentId,appliedRevision:1,currentRevision:1,notes:[],highlights:[],progress:null,conflicts:[],bookmarks:[]};
const mutation:BulletinReaderMutation={mutationId:'bookmark-create',createdAt:new Date(now).toISOString(),documentRevision:1,kind:'createBookmark',payload:{bookmarkId:bookmark.id,name:bookmark.name,sentenceId:'s0',offset:1,pageId:'p0'}};
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);sessionStorage.clear();vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('navigator',{onLine:true,locks:{request:async(_name:string,options:unknown,work?:()=>Promise<unknown>)=>typeof options==='function'?options():work!()}});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
function mount(offline=false,cloud=state){const api={privateState:vi.fn().mockResolvedValue({state:cloud}),renew:vi.fn().mockResolvedValue(value),mutate:vi.fn().mockResolvedValue({state:{...cloud,bookmarks:[bookmark]},results:[{mutationId:mutation.mutationId,status:'applied',revision:1,bookmark}]})};return{...renderHook(()=>usePrivateReader({api,selector,value,offline,allowAction:()=>true,onFailure:vi.fn()})),api};}
async function save(){const epoch=await activateOfflineAccount(selector.accountId);await commitOfflineSave({selector,value,epoch,resources:[],size:1,locked:false,lastObservedAt:now},epoch,now);await seedPrivateReplica(selector,state,epoch,now);return epoch;}
it('retains an unknown online mutation through return-state and retries the original ID without enqueueing',async()=>{
 const h=mount();await waitFor(()=>expect(h.result.current.state).not.toBeNull());h.api.mutate.mockRejectedValueOnce(new TypeError('lost acknowledgement'));
 await act(async()=>{await expect(h.result.current.mutate(mutation)).rejects.toThrow();});expect(readReaderReturn({accountId:selector.accountId,documentId:value.document.documentId})?.action).toEqual(mutation);
 await act(async()=>{await h.result.current.retry();});expect(h.api.mutate.mock.calls[1][2]).toEqual([mutation]);expect(h.result.current.bookmarkOutcome?.status).toBe('applied');expect(h.result.current.canRetry).toBe(false);
});
it('keeps concurrent notes/queue and newer cross-tab bookmark acknowledgements while merging only bookmarks',async()=>{
 const epoch=await save(),binding=(await readBookmarkCache(selector))!.binding;
 await enqueuePrivateMutation(selector,{mutationId:'note',createdAt:new Date(now).toISOString(),documentRevision:1,kind:'createNote',payload:{noteId:'note-a',text:'Keep durable text',sentenceIds:['s0']}},epoch,now);
 await mergeBookmarkCache(selector,binding,{...state,bookmarks:[{...bookmark,name:'newer',version:3}]});
 const merged=await mergeBookmarkCache(selector,binding,{...state,bookmarks:[bookmark]});
 expect(merged.state.bookmarks?.[0]).toMatchObject({name:'newer',version:3});expect(merged.state.notes[0].text).toBe('Keep durable text');expect(merged.queue).toHaveLength(1);expect(merged.confirmed.notes).toEqual([]);
});
it('never queues a bookmark and blocks existing durable writes before sending',async()=>{
 const epoch=await save(),h=mount();await waitFor(()=>expect(h.result.current.status).toBe('synced'));
 await enqueuePrivateMutation(selector,{mutationId:'progress',createdAt:new Date(now).toISOString(),documentRevision:1,kind:'setProgress',payload:{pageId:'p1'}},epoch,now);
 await act(async()=>{await expect(h.result.current.mutate(mutation)).rejects.toThrow('bookmark_pending_sync');});expect(h.api.mutate).not.toHaveBeenCalled();expect((await readPrivateReplica(selector,now))?.queue.map(e=>e.mutation.kind)).toEqual(['setProgress']);
});
it('keeps a known server acknowledgement when its saved instance changes during the request',async()=>{
 const epoch=await save(),h=mount();await waitFor(()=>expect(h.result.current.status).toBe('synced'));
 h.api.mutate.mockImplementationOnce(async()=>{await commitOfflineSave({selector,value,epoch,resources:[],size:2,locked:false,lastObservedAt:now},epoch,now);return{state:{...state,bookmarks:[bookmark]},results:[{mutationId:mutation.mutationId,status:'applied',revision:1,bookmark}]};});
 await act(async()=>{expect(await h.result.current.mutate(mutation)).toMatchObject({status:'applied'});});expect(h.result.current.canRetry).toBe(false);expect(h.result.current.bookmarkCacheWarning).toBe(true);expect(h.result.current.state?.bookmarks).toEqual([bookmark]);expect(h.api.mutate).toHaveBeenCalledOnce();expect((await readPrivateReplica(selector,now))?.queue).toEqual([]);
});
it('rejects offline, legacy capability and account epoch drift',async()=>{
 await save();const h=mount(true);await waitFor(()=>expect(h.result.current.state).not.toBeNull());await act(async()=>{await expect(h.result.current.mutate(mutation)).rejects.toThrow('bookmark_unavailable');});expect(h.api.mutate).not.toHaveBeenCalled();h.unmount();
 const legacy=mount(false,{...state,bookmarks:undefined});await waitFor(()=>expect(legacy.result.current.state).not.toBeNull());await act(async()=>{await expect(legacy.result.current.mutate(mutation)).rejects.toThrow('bookmark_unavailable');});legacy.unmount();
 const cache=await readBookmarkCache(selector);await clearOfflineAccount(selector.accountId);await expect(mergeBookmarkCache(selector,cache!.binding,{...state,bookmarks:[bookmark]})).rejects.toThrow();
});

it('retains the offline bookmark snapshot when an older producer omits capability',async()=>{
 const epoch=await save();await seedPrivateReplica(selector,{...state,bookmarks:[bookmark]},epoch,now);
 const h=mount(false,{...state,bookmarks:undefined});await waitFor(()=>expect(h.result.current.status).toBe('synced'));
 expect(h.result.current.bookmarksSupported).toBe(false);expect(h.result.current.state?.bookmarks).toEqual([bookmark]);expect((await readPrivateReplica(selector,now))?.confirmed.bookmarks).toEqual([bookmark]);
 await act(async()=>{await expect(h.result.current.mutate(mutation)).rejects.toThrow('bookmark_unavailable');});expect(h.api.mutate).not.toHaveBeenCalled();
 await expect(enqueuePrivateMutation(selector,mutation,epoch,now)).rejects.toThrow('bookmark_online_only');
});

it('does not let a delayed GET or note acknowledgement overwrite a newer bookmark tombstone',async()=>{
 const epoch=await save(),binding=(await readBookmarkCache(selector))!.binding;
 const deleted={...bookmark,version:3,deleted:true,name:'',sentenceId:'',pageId:'',offset:0};
 await mergeBookmarkCache(selector,binding,{...state,bookmarks:[deleted]});
 await seedPrivateReplica(selector,{...state,bookmarks:[bookmark]},epoch,now);
 expect((await readPrivateReplica(selector,now))?.state.bookmarks).toEqual([deleted]);
 const note:BulletinReaderMutation={mutationId:'delayed-note',createdAt:new Date(now).toISOString(),documentRevision:1,kind:'createNote',payload:{noteId:'note-a',sentenceIds:['s0'],text:'Keep note'}};
 await enqueuePrivateMutation(selector,note,epoch,now);
 const local=await readPrivateReplica(selector,now);
 const {acknowledgePrivateMutation}=await import('./offline-store');
 const acknowledged=await acknowledgePrivateMutation(selector,{state:{...state,notes:local!.state.notes,bookmarks:[bookmark]},results:[{mutationId:note.mutationId,status:'applied',revision:1}]},epoch,now);
 expect(acknowledged.state.bookmarks).toEqual([deleted]);expect(acknowledged.confirmed.bookmarks).toEqual([deleted]);expect(acknowledged.state.notes[0].text).toBe('Keep note');expect(acknowledged.queue).toEqual([]);
});
