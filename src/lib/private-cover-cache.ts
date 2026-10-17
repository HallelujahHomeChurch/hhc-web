// Private JPEGs only. Callers must validate current account and resource access
// before using this cache; HTTP responses and playback grants remain no-store.
type Cover = {key:string; accountId:string; resource:string; revision:string; expiresAt:number; touchedAt:number; blob:Blob};
type Image = Cover & {url?:string};
type Session = {key:'@account'; accountId:string|null; epoch:string};
const database='hhc-private-video-covers';
export const coverCacheChangeKey='hhc:video-covers:changed';
const maxEntries=64, maxBytes=32*1024*1024, maxAge=7*24*60*60*1000;
const keyFor=(accountId:string,resource:string,revision:string)=>JSON.stringify([accountId,resource,revision]);
const aborted=()=>new DOMException('Cover scope changed','AbortError');
const validBlob=(blob:Blob)=>blob?.type==='image/jpeg'&&blob.size>0&&blob.size<=1024*1024;
const request=<T>(value:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{value.onsuccess=()=>resolve(value.result);value.onerror=()=>reject(value.error);});

async function stored<T>(action:(store:IDBObjectStore)=>Promise<T>):Promise<T|undefined> {
 let db:IDBDatabase|undefined;
 try {
  if(typeof indexedDB==='undefined')return;
  const opening=indexedDB.open(database,1);
  opening.onupgradeneeded=()=>opening.result.createObjectStore('covers',{keyPath:'key'});
  db=await request(opening);
  const tx=db.transaction('covers','readwrite');
  const complete=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
  // Attach rejection handling before the first request can fail.
  const result=await Promise.all([action(tx.objectStore('covers')),complete]);
  return result[0];
 }catch{/* Optional browser storage never blocks online thumbnails. */}
 finally{db?.close();}
}

export class PrivateCoverCache {
 private accountId:string|null=null;
 private epoch='';
 private generation=0;
 private images=new Map<string,Image>();
 private pending=new Map<string,{controller:AbortController;promise:Promise<string>;resource:string}>();
 private resources=new Map<string,number>();
 private ready:Promise<void>=Promise.resolve();
 private listeners=new Set<()=>void>();
 private viewers=new Map<string,number>();
 private retired=new Map<string,string>();
 private touchedAt=0;
 private change=0;
 readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 readonly snapshot=()=>this.change;
 active(accountId:string){return this.accountId===accountId;}
 private notify(){this.change++;for(const listener of this.listeners)listener();}
 retain(url:string){this.viewers.set(url,(this.viewers.get(url)??0)+1);}
 retained(url:string){return this.viewers.has(url);}
 release(url:string){
  const count=this.viewers.get(url)??0;
  if(count>1){this.viewers.set(url,count-1);return;}
  this.viewers.delete(url);
  if(this.retired.delete(url))URL.revokeObjectURL(url);
 }
 private discard(key:string,force=false){
  const image=this.images.get(key);
  if(image?.url){
   if(!force&&this.viewers.has(image.url))this.retired.set(image.url,image.resource);
   else{URL.revokeObjectURL(image.url);this.viewers.delete(image.url);}
  }
  this.images.delete(key);
 }
 lock(){
  this.accountId=null;this.epoch='';this.generation++;
  for(const job of this.pending.values())job.controller.abort();
  this.pending.clear();this.resources.clear();
  for(const key of this.images.keys())this.discard(key,true);
  for(const url of this.retired.keys())URL.revokeObjectURL(url);
  this.retired.clear();this.viewers.clear();
  this.notify();
 }
 setAccount(accountId:string|null):Promise<void> {
  if(accountId!==null&&this.accountId===accountId)return this.ready;
  this.lock();this.accountId=accountId;
  const generation=this.generation;
  this.ready=(async()=>{
   const result=await stored(async store=>{
    const previous=await request(store.get('@account')) as Session|undefined;
    const changed=!previous||previous.accountId!==accountId||accountId===null;
    const session:Session=changed?{key:'@account',accountId,epoch:crypto.randomUUID()}:previous;
    if(changed){await request(store.clear());await request(store.put(session));}
    const covers=(await request(store.getAll()) as Cover[]).filter(item=>item.key!=='@account');
    const kept:Cover[]=[];let bytes=0;
    for(const cover of covers.sort((a,b)=>b.touchedAt-a.touchedAt)){
     if(cover.accountId!==accountId||!validBlob(cover.blob)||cover.expiresAt<=Date.now()||kept.length>=maxEntries||bytes+cover.blob.size>maxBytes){await request(store.delete(cover.key));continue;}
     kept.push(cover);bytes+=cover.blob.size;
    }
    return {session,covers:kept,changed};
   });
   if(this.generation!==generation)return;
   this.epoch=result?.session.epoch??'';
   for(const cover of result?.covers??[]){this.images.set(cover.key,cover);this.touchedAt=Math.max(this.touchedAt,cover.touchedAt);}
   if(result?.changed){try{localStorage.setItem(coverCacheChangeKey,result.session.epoch);}catch{/* Storage events are best effort. */}}
   this.notify();
  })();
  return this.ready;
 }
 peek(accountId:string,resource:string,revision:string,expiresAt:number):string|undefined {
  if(this.accountId!==accountId||!revision||Number.isNaN(expiresAt)||expiresAt<=Date.now())return;
  const key=keyFor(accountId,resource,revision),image=this.images.get(key);
  if(!image)return;
  if(image.expiresAt<=Date.now()){this.discard(key,true);return;}
  image.url??=URL.createObjectURL(image.blob);
  return image.url;
 }
 async load(accountId:string,resource:string,revision:string,expiresAt:number,download:(signal:AbortSignal)=>Promise<Blob>):Promise<string> {
  const generation=this.generation;
  await this.ready;
  if(this.accountId!==accountId||generation!==this.generation||Number.isNaN(expiresAt)||expiresAt<=Date.now()||!revision)throw aborted();
  const key=keyFor(accountId,resource,revision);
  for(const [oldKey,job] of this.pending)if(job.resource===resource&&oldKey!==key){job.controller.abort();this.pending.delete(oldKey);}
  const cached=this.peek(accountId,resource,revision,expiresAt);if(cached)return cached;
  const existing=this.pending.get(key);if(existing)return existing.promise;
  const controller=new AbortController(),resourceGeneration=(this.resources.get(resource)??0)+1,epoch=this.epoch;
  this.resources.set(resource,resourceGeneration);
  const current=()=>this.accountId===accountId&&this.generation===generation&&!controller.signal.aborted&&(this.resources.get(resource)??0)===resourceGeneration&&expiresAt>Date.now();
  const promise=(async()=>{
   const blob=await download(controller.signal);
   if(!current())throw aborted();
   if(!validBlob(blob))throw new Error('Invalid private cover');
   const cover:Cover={key,accountId,resource,revision,expiresAt:Math.min(expiresAt,Date.now()+maxAge),touchedAt:this.touchedAt=Math.max(Date.now(),this.touchedAt+1),blob};
   const saved=epoch?await stored(async store=>{
    const session=await request(store.get('@account')) as Session|undefined;
    if(!current()||session?.accountId!==accountId||session.epoch!==epoch)return false;
    const covers=(await request(store.getAll()) as Cover[]).filter(item=>item.key!=='@account'&&item.key!==key);
    await request(store.put(cover));
    const candidates=[cover,...covers.filter(item=>item.resource!==resource)].sort((a,b)=>b.touchedAt-a.touchedAt);
    let bytes=0;const keep=new Set<string>();
    for(const item of candidates)if(item.expiresAt>Date.now()&&keep.size<maxEntries&&bytes+item.blob.size<=maxBytes){keep.add(item.key);bytes+=item.blob.size;}
    for(const item of covers)if(!keep.has(item.key))await request(store.delete(item.key));
    return true;
   }):undefined;
   if(saved===false||!current())throw aborted();
   for(const [oldKey,image] of this.images)if(image.resource===resource)this.discard(oldKey);
   this.images.set(key,cover);
   let bytes=[...this.images.values()].reduce((sum,item)=>sum+item.blob.size,0);
   for(const [oldKey,image] of [...this.images].sort((a,b)=>a[1].touchedAt-b[1].touchedAt)){
    if(this.images.size<=maxEntries&&bytes<=maxBytes)break;
    bytes-=image.blob.size;this.discard(oldKey);
   }
   return this.peek(accountId,resource,revision,expiresAt)!;
  })().finally(()=>{if(this.pending.get(key)?.controller===controller)this.pending.delete(key);});
  this.pending.set(key,{controller,promise,resource});return promise;
 }
 async checkSession():Promise<void> {
  const generation=this.generation;
  await this.ready;
  const session=await stored(async store=>await request(store.get('@account')) as Session|undefined);
  if(this.generation===generation&&(!session||session.accountId!==this.accountId||session.epoch!==this.epoch))this.lock();
 }
 async forget(accountId:string,resource:string):Promise<void> {
  if(this.accountId!==accountId)return;
  this.resources.set(resource,(this.resources.get(resource)??0)+1);
  for(const [key,image] of this.images)if(image.resource===resource)this.discard(key,true);
  for(const [url,owner] of this.retired)if(owner===resource){URL.revokeObjectURL(url);this.retired.delete(url);this.viewers.delete(url);}
  for(const [key,job] of this.pending)if(job.resource===resource){job.controller.abort();this.pending.delete(key);}
  this.notify();
  const epoch=this.epoch;
  await stored(async store=>{
   const session=await request(store.get('@account')) as Session|undefined;
   if(session?.accountId!==accountId||session.epoch!==epoch)return;
   for(const cover of await request(store.getAll()) as Cover[])if(cover.accountId===accountId&&cover.resource===resource)await request(store.delete(cover.key));
  });
 }
}

export const privateCoverCache=new PrivateCoverCache();
