// Synthetic loopback preview; no production accounts or services.
import {createRequire} from 'node:module';
import {mkdtemp, writeFile, symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const source=process.argv[2], require=createRequire(join(source,'package.json'));
const viteRequire=createRequire(require.resolve('vitest/package.json'));
const tailwind=(await import(require.resolve('@tailwindcss/postcss'))).default;
const {createServer}=await import(viteRequire.resolve('vite'));
const root=await mkdtemp(join(tmpdir(),'reader-notes-preview-'));
await symlink(join(source,'node_modules'),join(root,'node_modules'));
await writeFile(join(root,'index.html'),'<html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(join(root,'entry.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import '${source}/src/app/globals.css';
import {WeeklyReader} from '${source}/src/components/weekly-reader/WeeklyReader';
import {OfflineContentPage} from '${source}/src/components/weekly-reader/OfflineContentPage';
import {activateOfflineAccount,commitOfflineSave,seedPrivateReplica,clearOfflineAccount} from '${source}/src/features/weekly-reader/offline-store';
import {getMessages} from '${source}/src/i18n/messages';
import {readerFixture} from '${source}/src/features/weekly-reader/test-fixture';
import {saveReaderReturn, clearReaderReturn} from '${source}/src/features/weekly-reader/return-state';
import {createReaderPreviewStore} from '${source}/scripts/reader-preview-store';
import '@hallelujahhomechurch/ui/styles.css';
window.fixtureValue=readerFixture();
const value=window.fixtureValue;value.access.accountId='local-fixture-account';
const fixtureTime=Date.now();value.access.validatedAt=new Date(fixtureTime).toISOString();value.access.offlineValidUntil=new Date(fixtureTime+604800000).toISOString();
value.document.canonicalMetadata.title='閱讀與筆記合成測試';
const store=createReaderPreviewStore();
const note={mutationId:'fixture-seed',documentRevision:1,createdAt:new Date().toISOString(),kind:'createNote',payload:{noteId:'fixture-note',sentenceIds:['s0'],text:'這是一段用來檢查筆記版面與操作的合成文字。\\n'.repeat(12)}};
store.mutate(value.document,[note]);
store.mutate(value.document,[{mutationId:'fixture-highlight',documentRevision:1,createdAt:new Date().toISOString(),kind:'setHighlight',payload:{sentenceIds:['s1'],color:'yellow'}}]);
const previewParams=new URLSearchParams(location.search);
let fixtureBookmarks=previewParams.get('bookmarks')==='empty'?[]:[{id:'00000000-0000-4000-8000-000000000010',name:previewParams.get('bookmarks')==='long'?'這是跨裝置保存的閱讀位置與下次聚會需要查閱的提醒😀'.repeat(3):'下次從這裡繼續閱讀',sentenceId:'s0',offset:0,pageId:'p0',documentRevision:1,version:1,deleted:false,reanchorRequired:previewParams.get('bookmarks')==='invalid',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
if(previewParams.get('bookmarks')==='99')fixtureBookmarks=Array.from({length:99},(_,i)=>({...fixtureBookmarks[0],id:crypto.randomUUID(),name:'Saved '+(i+1)}));
const originalStoreMutate=store.mutate.bind(store),bookmarkReceipts=new Map();
store.mutate=(document,mutations)=>{if(!mutations.some(m=>m.kind.endsWith('Bookmark')))return {...originalStoreMutate(document,mutations),state:store.read(document)};const mutation=mutations[0],prior=bookmarkReceipts.get(mutation.mutationId);if(prior)return prior;const payload=mutation.payload,index=fixtureBookmarks.findIndex(b=>b.id===payload.bookmarkId),old=fixtureBookmarks[index];let status='applied',bookmark;
if(previewParams.get('bookmarks')==='conflict'&&old){bookmark={...old,name:'另一台裝置修改的書籤名稱',version:old.version+1};fixtureBookmarks[index]=bookmark;status='bookmark_conflict';}
else if(mutation.kind==='createBookmark'){bookmark={...payload,id:payload.bookmarkId,documentRevision:document.revision,version:1,deleted:false,reanchorRequired:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};fixtureBookmarks.push(bookmark);}
else if(old&&old.version===mutation.baseVersion){bookmark={...old,...payload,version:old.version+1,deleted:mutation.kind==='deleteBookmark',...(mutation.kind==='reanchorBookmark'?{documentRevision:document.revision,reanchorRequired:false}:{})};fixtureBookmarks[index]=bookmark;}
else {bookmark=old;status='bookmark_conflict';}
const response={state:store.read(document),results:[{mutationId:mutation.mutationId,status,revision:document.revision,bookmark}]};bookmarkReceipts.set(mutation.mutationId,response);return response;};
const readPreview=store.read;store.read=(document)=>({...readPreview(document),...(previewParams.get('bookmarks')==='legacy'?{}:{bookmarks:structuredClone(fixtureBookmarks)}),highlightHistory:[{id:'fixture-history',highlight:{sentenceId:'old-sentence',quote:'舊版合成引用文字。',color:'red',active:false,version:1,updatedAt:''}}]});
window.fixtureApi={open:async()=>value,current:async()=>value,renew:async()=>value,privateState:async()=>({state:store.read(value.document),fromRevision:value.document.revision,mappings:[]}),mutate:async(_selector,_value,mutations)=>{if(window.fixtureDelay)await new Promise(r=>setTimeout(r,window.fixtureDelay));return store.mutate(value.document,mutations);}};
window.fixtureState=()=>store.read(value.document);
const scenario=new URLSearchParams(location.search).get('scenario');
const originalMutate=window.fixtureApi.mutate;
if(scenario==='wait')window.fixtureDelay=60000;
if(scenario==='error')window.fixtureApi.mutate=async()=>{throw new TypeError('synthetic network failure');};
if(scenario==='loaderror'){let failed=false;const read=window.fixtureApi.privateState;window.fixtureApi.privateState=async(...args)=>{if(!failed){failed=true;throw new TypeError('synthetic notes loading failure');}return read(...args);};}
if(scenario==='conflict'||scenario==='deleted'){window.fixtureApi.mutate=async(_selector,_value,mutations)=>{const mutation=mutations[0];const cloud={...store.read(value.document).notes[0],text:'雲端修改的合成筆記。',version:2,deleted:scenario==='deleted'};return {state:{...store.read(value.document),notes:[cloud]},results:[{mutationId:mutation.mutationId,status:'note_conflict',revision:1,note:cloud}]};};}

clearReaderReturn({accountId:'local-fixture-account',documentId:value.document.documentId});
for(const key of Object.keys(sessionStorage))if(key.startsWith('weekly-reader-position:local-fixture-account:'))sessionStorage.removeItem(key);
await activateOfflineAccount('local-fixture-account');
const params=new URLSearchParams(location.search);
const locale=['en','ja','ko','zh-Hans','zh-Hant'].includes(params.get('locale'))?params.get('locale'):'zh-Hant';
document.documentElement.dataset.theme=params.get('theme')==='dark'?'dark':'light';localStorage.setItem('hhc-reader-theme',document.documentElement.dataset.theme);
if(params.get('mode')!=='editor')saveReaderReturn({accountId:'local-fixture-account',documentId:value.document.documentId},{revision:1,draft:undefined});
if(params.get('mode')==='editor')saveReaderReturn({accountId:'local-fixture-account',documentId:value.document.documentId},{revision:1,draft:{text:'尚未儲存的合成筆記。\\n'.repeat(12)}});
if(scenario==='loaderror'||scenario==='error'){await clearOfflineAccount('local-fixture-account');await activateOfflineAccount('local-fixture-account');}
if(scenario==='partial'){await clearOfflineAccount('local-fixture-account');await activateOfflineAccount('local-fixture-account');const read=store.read;store.read=(doc)=>({...read(doc),conflicts:[{id:'fixture-partial-conflict',sentenceIds:['s0'],sources:[{sentenceId:'old',quote:'舊版藍色標註需要確認整段覆蓋。',color:'red',segments:[{start:2,end:6,color:'blue'}]}]}]});let reads=0;window.fixtureApi.privateState=async()=>({state:{...store.read(value.document),currentRevision:++reads===1?2:1}});}

if(params.get('view')==='offline'){const epoch=await activateOfflineAccount('local-fixture-account');await commitOfflineSave({selector:{accountId:'local-fixture-account',issueNumber:1739,series:'general',contentLocale:'zh-Hant'},value,resources:[],size:1024,lastObservedAt:Date.now(),epoch,locked:false},epoch);saveReaderReturn({accountId:'local-fixture-account',documentId:value.document.documentId},{revision:1,draft:{text:'待同步的合成離線草稿。'}});}
if(scenario==='bookmark-offline'){const epoch=await activateOfflineAccount('local-fixture-account');const selector={accountId:'local-fixture-account',issueNumber:1739,series:'general',contentLocale:'zh-Hant'};await commitOfflineSave({selector,value,resources:[],size:1024,lastObservedAt:Date.now(),epoch,locked:false},epoch);await seedPrivateReplica(selector,store.read(value.document),epoch);window.fixtureApi.open=window.fixtureApi.renew=async()=>{throw new TypeError('synthetic offline network');};}
const Prototype=params.has('prototype')?(await import('${source}/docs/reviews/reader-professional-20261019/Prototype.tsx')).Prototype:()=>null;\ncreateRoot(document.getElementById('root')).render(params.has('prototype')?<Prototype/>:params.get('view')==='offline'?<OfflineContentPage locale={locale} messages={getMessages(locale).weeklyReader}/>:<WeeklyReader locale={locale} issueNumber={1739} series="general" contentLocale="zh-Hant" messages={getMessages(locale).weeklyReader}/>);
`);
const server=await createServer({configFile:false,root,publicDir:join(source,'public'),css:{postcss:{plugins:[tailwind()]}},server:{host:'127.0.0.1',port:7152,strictPort:true,fs:{allow:[root,source]}},define:{'process.env.NEXT_PUBLIC_WEEKLY_READER_ENABLED':'"true"'},resolve:{alias:[{find:'@/components/layout/AccountControl',replacement:'virtual:account'},{find:'@/features/weekly-reader/api',replacement:'virtual:api'},{find:'next/navigation',replacement:'virtual:next'},{find:'@',replacement:join(source,'src')}]},plugins:[{name:'synthetic-only',resolveId(id){if(id.startsWith('virtual:'))return id;},load(id){if(id==='virtual:account')return `const auth={status:'authenticated'},authorization={getAccessToken:async()=>null};export const useAccountIdentity=()=> 'local-fixture-account';export const useAccountAuth=()=>auth;export const useAccountSignIn=()=>null;export const useBulletinAuthorization=()=>authorization;export const useBulletinAccess=()=>({status:'available',editions:[{series:'general',locale:'zh-Hant'}]});`;if(id==='virtual:api')return `export {verifyReaderAccess} from '${source}/src/features/weekly-reader/api.ts';export const createReaderApi=()=>window.fixtureApi;`;if(id==='virtual:next')return `export const useRouter=()=>({push(){}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`;}}]});
await server.listen();console.log(JSON.stringify({origin:'http://127.0.0.1:7152',source,root,synthetic:true}));
