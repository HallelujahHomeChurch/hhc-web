// Test-only loopback entry. Never import this into the application or deploy it.
import {createRequire} from 'node:module';
import {mkdtemp, writeFile, symlink} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const source = resolve(process.argv[2] ?? '.');
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vitest/package.json'));
const {createServer} = await import(viteRequire.resolve('vite'));
const root = await mkdtemp(join(tmpdir(), 'bulletin-browser-entry-'));
await symlink(resolve('node_modules'), join(root, 'node_modules'));
await writeFile(join(root, 'index.html'), '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(join(root, 'entry.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {OfflineContentPage} from '${source}/src/components/weekly-reader/OfflineContentPage';
import {NoteReanchor} from '${source}/src/components/weekly-reader/NoteReanchor';
import {HighlightHistory} from '${source}/src/components/weekly-reader/HighlightHistory';
import {ReaderTypography} from '${source}/src/components/weekly-reader/ReaderTypography';
import {BulletinEbook, BulletinDocumentRenderer} from '@hallelujahhomechurch/ui';
import '@hallelujahhomechurch/ui/styles.css';
import '@hallelujahhomechurch/ui/bulletin-paper.css';
import '@hallelujahhomechurch/ui/bulletin-paper-v2.css';
import '@hallelujahhomechurch/ui/bulletin-paper-v7.css';
import '@hallelujahhomechurch/ui/bulletin-ebook.css';
import '${source}/src/components/weekly-reader/reader.css';
import {getMessages} from '${source}/src/i18n/messages';
import {readerFixture} from '${source}/src/features/weekly-reader/test-fixture';
import * as store from '${source}/src/features/weekly-reader/offline-store';
const T = Date.parse('2026-10-02T00:00:00Z');
Date.now = () => T;
let root;
const selector = (i, locale) => ({accountId:'account-a', issueNumber:1739+i, series:'general', contentLocale:locale});
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte=>byte.toString(16).padStart(2,'0')).join('');
window.bulletinFixture = {
  source: ${JSON.stringify(source)}, T,
  async seed(count) {
    if (![1,5,20].includes(count)) throw Error('invalid_fixture_count');
    const epoch = await store.activateOfflineAccount('account-a');
    const manifest=[];
    for(let i=0;i<count;i++) {
      const version = i%10+1, locale = version===2 ? 'zh-Hans' : i%2 ? 'zh-Hans' : 'zh-Hant';
      const value=readerFixture(locale,version>2?'v'+version:undefined);
      value.document.documentId=value.access.documentId='fixture-document-'+i;
      value.document.issueId='fixture-issue-'+i;
      value.document.canonicalMetadata.issueNumber=1739+i;
      const status=i%3===1?'expired':i%3===2?'locked':'current';
      const validatedAt=status==='expired'?T-8*86400000:T-86400000;
      value.access.validatedAt=new Date(validatedAt).toISOString();
      value.access.offlineValidUntil=new Date(validatedAt+604800000).toISOString();
      const route=selector(i,locale);
      const staged=await store.stageOfflineSave(value,route,fetch,validatedAt);
      await store.commitOfflineSave(staged,epoch,validatedAt);
      if(status==='locked') await store.lockOfflineSave(route);
      manifest.push({selector:route,documentId:value.access.documentId,revision:value.access.revision,epoch,status,size:staged.size,documentSha256:await digest(value.document),accessSha256:await digest(value.access),validatedAt:value.access.validatedAt,offlineValidUntil:value.access.offlineValidUntil,resources:staged.resources.map((resource,index)=>({url:resource.url,byteLength:resource.bytes.byteLength,sha256:value.document.content.layoutManifest.assets[index].sha256}))});
    }
    return manifest;
  },
  mount() {
    if(root) throw Error('already_mounted');
    root=createRoot(document.getElementById('root'));
    flushSync(()=>root.render(<OfflineContentPage locale="en" messages={getMessages('en').weeklyReader}/>));
  },
  mountTypography(locale = 'zh-Hant') {
    if(root) throw Error('already_mounted');
    const document=readerFixture(locale,'v10').document.content;
    const block=document.components[0].items[0].blocks[0];
    block.style.fontSize=14;
    block.sentences[0].spans=[{text:'一般文字',fontRole:'body',fontSize:12},{text:'標楷經文',fontRole:'scripture',fontSize:12},{text:'重點文字',fontRole:'emphasis',fontSize:20}];
    document.components=[{id:'c0',type:'bodySection',bodySection:{kind:'sermon',title:{...block,id:'title',sentences:[{id:'title-sentence',spans:[{text:'信息標題',fontRole:'body'}]}]},blocks:[block]}}];
    document.layoutManifest.pages[0].slots[0].fragments[0].end=12;
    const original=JSON.stringify(document);
    function TypographyExample() {
      const [value,setValue]=React.useState({size:18,line:1.8});
      return <main className="weekly-reader" data-theme="light"><section className="reader-document" data-mobile style={{'--reader-font-size':value.size+'px'}}>
        <ReaderTypography value={value} onChange={setValue} messages={getMessages('en').weeklyReader}/>
        <BulletinEbook document={document} chapter="body"/>
      </section><section className="reader-document" data-typography-paper><BulletinDocumentRenderer document={document} mode="paper" activePage="p0"/></section></main>;
    }
    root=createRoot(window.document.getElementById('root'));
    flushSync(()=>root.render(<TypographyExample/>));
    window.typographySourceUnchanged=()=>JSON.stringify(document)===original;
  },
  mountRecovery(kind, mobile) {
    if(root) throw Error('already_mounted');
    root=createRoot(document.getElementById('root'));
    window.fixtureActions=[];
    const messages=getMessages('en').weeklyReader, bulletin=readerFixture().document;
    const note={id:'fixture-note',text:'Synthetic note',quote:'Original quote',sentenceIds:[],inactiveAnchors:[],version:1,deleted:false,reanchorRequired:true,createdAt:'',updatedAt:''};
    const content=kind==='note'?<NoteReanchor note={note} document={bulletin} messages={messages} mobile={mobile} onSave={async (note,ranges)=>{window.fixtureActions.push({note,ranges});return {status:'applied'};}} onComplete={()=>{}} onCancel={()=>{}}/>:<HighlightHistory history={[{id:'fixture-history',highlight:{sentenceId:'gone',quote:'Old quote',color:'red',active:false,version:1,updatedAt:''}}]} document={bulletin} messages={messages} mobile={mobile} busy={false} onSave={async mutation=>{window.fixtureActions.push(mutation);}}/>;
    flushSync(()=>root.render(content));
  },
  unmount() { if(root) flushSync(()=>root.unmount()); root=undefined; },
  async summaries() {
    const items=await store.listOfflineSaves('account-a');
    return items.map(item=>({keys:Object.keys(item).sort(),selector:item.selector,documentId:item.documentId??item.value.access.documentId,revision:item.revision??item.value.access.revision,size:item.size,offlineValidUntil:item.offlineValidUntil??item.value.access.offlineValidUntil}));
  },
  async availability() {
    const items=await store.listOfflineSaves('account-a');
    return Promise.all(items.map(async item=>({selector:item.selector,status:(await store.readOfflineSave(item.selector))?.status??null})));
  }
};
`);
const server = await createServer({
  configFile: false, root, publicDir: join(source, 'public'),
  server: {host: '127.0.0.1', port: 7143, strictPort: true, fs: {allow: [root, source, resolve('.')]}},
  define: {'process.env.NEXT_PUBLIC_WEEKLY_READER_ENABLED': '"true"'},
  resolve: {alias: [{find:'@/components/layout/AccountControl',replacement:'virtual:fixture-account'},{find:'@',replacement:join(source,'src')}]},
  plugins: [{name:'synthetic-account-only',resolveId(id){if(id==='virtual:fixture-account')return id;},load(id){if(id==='virtual:fixture-account')return 'export const useAccountIdentity = () => "account-a";';}}],
});
await server.listen();
assert.equal(server.config.server.host, '127.0.0.1');
assert.equal(server.config.server.port, 7143);
console.log(JSON.stringify({origin:'http://127.0.0.1:7143',source,root,synthetic:true,sw:'none: fixture entry does not register a service worker'}));
