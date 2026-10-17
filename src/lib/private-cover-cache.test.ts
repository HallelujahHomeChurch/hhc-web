import {Blob as NodeBlob} from 'node:buffer';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PrivateCoverCache} from './private-cover-cache';

const jpeg=()=>new NodeBlob(['private image'],{type:'image/jpeg'}) as unknown as Blob;
const deadline=()=>Date.now()+60_000;
beforeEach(()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());
 vi.spyOn(URL,'createObjectURL').mockImplementation(()=>`blob:${crypto.randomUUID()}`);
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it('reuses a downloaded cover in memory and after a new browser instance opens IndexedDB',async()=>{
 const first=new PrivateCoverCache();await first.setAccount('alice');
 const download=vi.fn(async()=>jpeg());
 const original=await first.load('alice','vod:one','cover-1',deadline(),download);
 expect(first.peek('alice','vod:one','cover-1',deadline())).toBe(original);
 await first.load('alice','vod:one','cover-1',deadline(),download);
 const restarted=new PrivateCoverCache();await restarted.setAccount('alice');
 expect(restarted.peek('alice','vod:one','cover-1',deadline())).toMatch(/^blob:/);
 await restarted.load('alice','vod:one','cover-1',deadline(),download);
 expect(download).toHaveBeenCalledOnce();
});
it('downloads a changed revision and discards expired or explicitly invalidated images',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const download=vi.fn(async()=>jpeg());
 const first=await cache.load('alice','vod:one','v1',deadline(),download);
 expect(cache.peek('alice','vod:one','v2',deadline())).toBeUndefined();
 await cache.load('alice','vod:one','v2',deadline(),download);
 expect(download).toHaveBeenCalledTimes(2);expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
 expect(cache.peek('alice','vod:one','v2',Date.now()-1)).toBeUndefined();
 await cache.forget('alice','vod:one');
 const restarted=new PrivateCoverCache();await restarted.setAccount('alice');
 expect(restarted.peek('alice','vod:one','v2',deadline())).toBeUndefined();
});
it('isolates accounts and purges persisted images on logout',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const url=await cache.load('alice','vod:one','v1',deadline(),async()=>jpeg());
 await cache.setAccount('bob');
 expect(cache.peek('alice','vod:one','v1',deadline())).toBeUndefined();
 expect(cache.peek('bob','vod:one','v1',deadline())).toBeUndefined();
 expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
 await cache.load('bob','vod:one','v1',deadline(),async()=>jpeg());
 await cache.setAccount(null);
 const restarted=new PrivateCoverCache();await restarted.setAccount('bob');
 expect(restarted.peek('bob','vod:one','v1',deadline())).toBeUndefined();
});
it('rejects late downloads after logout, including a logout from another tab',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 let done!:(blob:Blob)=>void;
 const download=cache.load('alice','vod:one','v1',deadline(),()=>new Promise<Blob>(resolve=>{done=resolve}));
 await vi.waitFor(()=>expect(done).toBeTypeOf('function'));
 const otherTab=new PrivateCoverCache();await otherTab.setAccount(null);
 done(jpeg());await expect(download).rejects.toMatchObject({name:'AbortError'});
 const restarted=new PrivateCoverCache();await restarted.setAccount('alice');
 expect(restarted.peek('alice','vod:one','v1',deadline())).toBeUndefined();
});
it('still displays downloads when IndexedDB is unavailable and rejects invalid images',async()=>{
 vi.stubGlobal('indexedDB',undefined);
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 await expect(cache.load('alice','vod:one','v1',deadline(),async()=>jpeg())).resolves.toMatch(/^blob:/);
 await expect(cache.load('alice','vod:two','v1',deadline(),async()=>new NodeBlob(['bad'],{type:'text/html'}) as unknown as Blob)).rejects.toThrow();
 expect(cache.peek('alice','vod:two','v1',deadline())).toBeUndefined();
});
it('bounds retained images and does not restore evicted images on restart',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const first=await cache.load('alice','vod:0','v1',deadline(),async()=>jpeg());
 for(let i=1;i<=64;i++)await cache.load('alice',`vod:${i}`,'v1',deadline(),async()=>jpeg());
 expect(cache.peek('alice','vod:0','v1',deadline())).toBeUndefined();
 expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
 const restarted=new PrivateCoverCache();await restarted.setAccount('alice');
 expect(restarted.peek('alice','vod:0','v1',deadline())).toBeUndefined();
});
it('does not retain a cover with an invalid expiry',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const download=vi.fn(async()=>jpeg());
 await expect(cache.load('alice','vod:one','v1',NaN,download)).rejects.toThrow();
 expect(download).not.toHaveBeenCalled();
});
it('coalesces concurrent consumers and never caches a failed download',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const download=vi.fn(async()=>jpeg());
 const [one,two]=await Promise.all([cache.load('alice','vod:one','v1',deadline(),download),cache.load('alice','vod:one','v1',deadline(),download)]);
 expect(one).toBe(two);expect(download).toHaveBeenCalledOnce();
 await expect(cache.load('alice','vod:two','v1',deadline(),async()=>{throw Error('offline');})).rejects.toThrow('offline');
 expect(cache.peek('alice','vod:two','v1',deadline())).toBeUndefined();
});
it('rejects a superseded revision that finishes after the new cover',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 let finish!:(blob:Blob)=>void;
 const old=cache.load('alice','vod:one','old',deadline(),()=>new Promise<Blob>(resolve=>{finish=resolve}));
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
 const fresh=await cache.load('alice','vod:one','new',deadline(),async()=>jpeg());
 finish(jpeg());await expect(old).rejects.toMatchObject({name:'AbortError'});
 expect(cache.peek('alice','vod:one','new',deadline())).toBe(fresh);
 expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(fresh);
});
it('keeps a displayed URL alive through eviction until its last mounted viewer releases it',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const first=await cache.load('alice','vod:0','v1',deadline(),async()=>jpeg());
 cache.retain(first);
 for(let i=1;i<=64;i++)await cache.load('alice',`vod:${i}`,'v1',deadline(),async()=>jpeg());
 expect(cache.peek('alice','vod:0','v1',deadline())).toBeUndefined();
 expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(first);
 cache.release(first);expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
});
it('ignores a stale cross-tab check while a different account is initializing',async()=>{
 const cache=new PrivateCoverCache();await cache.setAccount('alice');
 const original=IDBObjectStore.prototype.get;let switching:Promise<void>|undefined;
 vi.spyOn(IDBObjectStore.prototype,'get').mockImplementation(function(this:IDBObjectStore,key){
  const result=original.call(this,key);
  if(!switching&&key==='@account')switching=cache.setAccount('bob');
  return result;
 });
 await cache.checkSession();await switching;
 expect(cache.active('bob')).toBe(true);
});
