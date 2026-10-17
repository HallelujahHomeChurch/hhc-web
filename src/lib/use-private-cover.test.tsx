import {Blob as NodeBlob} from 'node:buffer';
import {IDBFactory} from 'fake-indexeddb';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PrivateCoverCache,coverCacheChangeKey} from './private-cover-cache';
import {PrivateCoverProvider,usePrivateCover} from './use-private-cover';

const scope={};
const until=Date.now()+60_000;
const jpeg=()=>new NodeBlob(['private'],{type:'image/jpeg'}) as unknown as Blob;
function Cover({load,revision='v1',expiresAt=until}:{load:(signal:AbortSignal)=>Promise<Blob>;revision?:string;expiresAt?:number}){
 const url=usePrivateCover({scope,resource:'vod:one',revision,expiresAt,load});
 // eslint-disable-next-line @next/next/no-img-element
 return url?<img src={url} alt="Cover"/>:<span>No image</span>;
}
beforeEach(()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.spyOn(URL,'createObjectURL').mockImplementation(()=>`blob:${crypto.randomUUID()}`);vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('shows an already loaded cover on remount without another download',async()=>{
 const cache=new PrivateCoverCache(),load=vi.fn(async()=>jpeg());
 const view=render(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load}/></PrivateCoverProvider>);
 const url=(await screen.findByRole('img')).getAttribute('src');view.unmount();
 expect(URL.revokeObjectURL).not.toHaveBeenCalled();
 await cache.setAccount('alice');
 render(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load}/></PrivateCoverProvider>);
 await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src',url));
 expect(load).toHaveBeenCalledOnce();
});
it('restores a cover from IndexedDB after restarting and waits for verified account access',async()=>{
 const cache=new PrivateCoverCache(),load=vi.fn(async()=>jpeg());
 await cache.setAccount('alice');await cache.load('alice','vod:one','v1',until,load);
 const restarted=new PrivateCoverCache();
 const view=render(<PrivateCoverProvider accountId={undefined} cache={restarted}><Cover load={load}/></PrivateCoverProvider>);
 expect(screen.queryByRole('img')).toBeNull();expect(load).toHaveBeenCalledOnce();
 view.rerender(<PrivateCoverProvider accountId="alice" cache={restarted}><Cover load={load}/></PrivateCoverProvider>);
 await screen.findByRole('img');expect(load).toHaveBeenCalledOnce();
 view.rerender(<PrivateCoverProvider accountId={null} cache={restarted}><Cover load={load}/></PrivateCoverProvider>);
 expect(screen.queryByRole('img')).toBeNull();
 await waitFor(()=>expect(restarted.peek('alice','vod:one','v1',until)).toBeUndefined());
});
it('replaces updated covers and removes images when another tab clears the account',async()=>{
 const cache=new PrivateCoverCache(),load=vi.fn(async()=>jpeg());
 const view=render(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load}/></PrivateCoverProvider>);
 const first=(await screen.findByRole('img')).getAttribute('src');
 view.rerender(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load} revision="v2"/></PrivateCoverProvider>);
 await waitFor(()=>expect(screen.getByRole('img').getAttribute('src')).not.toBe(first));
 expect(load).toHaveBeenCalledTimes(2);
 const otherTab=new PrivateCoverCache();await otherTab.setAccount(null);
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:coverCacheChangeKey,newValue:'logout'})));
 await waitFor(()=>expect(screen.queryByRole('img')).toBeNull());
});
it('keeps thumbnails usable after a same-account tab initializes the cache',async()=>{
 const cache=new PrivateCoverCache(),load=vi.fn(async()=>jpeg());
 render(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load}/></PrivateCoverProvider>);
 const first=(await screen.findByRole('img')).getAttribute('src');
 const otherTab=new PrivateCoverCache();await otherTab.setAccount('alice');
 await act(async()=>{window.dispatchEvent(new StorageEvent('storage',{key:coverCacheChangeKey,newValue:'initialization'}));await cache.checkSession();});
 expect(screen.getByRole('img')).toHaveAttribute('src',first);expect(load).toHaveBeenCalledOnce();
});
it('preserves a mounted image after reusable cache eviction, then releases its URL on unmount',async()=>{
 const cache=new PrivateCoverCache(),load=vi.fn(async()=>jpeg());
 const view=render(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load}/></PrivateCoverProvider>);
 const first=(await screen.findByRole('img')).getAttribute('src');
 await act(async()=>{for(let i=0;i<64;i++)await cache.load('alice',`vod:other-${i}`,'v1',until,async()=>jpeg());});
 view.rerender(<PrivateCoverProvider accountId="alice" cache={cache}><Cover load={load}/></PrivateCoverProvider>);
 expect(screen.getByRole('img')).toHaveAttribute('src',first);expect(load).toHaveBeenCalledOnce();
 view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
});
