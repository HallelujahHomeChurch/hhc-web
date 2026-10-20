// T0 only: actual house overlays, tabs and reader components, synthetic content.
import {useLayoutEffect, useState} from 'react';
import {ChevronLeft} from 'lucide-react';
import {ReaderIconButton} from '@/components/weekly-reader/ReaderIconButton';
import {Drawer, Tabs, BulletinEbook} from '@hallelujahhomechurch/ui';
import {ReaderPrivateState} from '@/components/weekly-reader/ReaderPrivateState';
import {ReaderSearch} from '@/components/weekly-reader/ReaderSearch';
import {ReaderTypography} from '@/components/weekly-reader/ReaderTypography';
import {SectionNavigator} from '@/components/weekly-reader/SectionNavigator';
import {NotesPanel} from '@/components/weekly-reader/NotesPanel';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {verifyReaderAccess} from '@/features/weekly-reader/api';
import './proposal.css';
import {wordPrototype} from './word-browser-prototype';
const value = readerFixture(), m = getMessages('zh-Hant').weeklyReader;
const documentValue = verifyReaderAccess(value,{accountId:'account-a',issueNumber:1739,series:'general',contentLocale:'zh-Hant'});
const note = {id:'prototype',text:'讓閱讀保持專注，工具在需要的時候出現。\n我的筆記與引用分開呈現，回到原文也能保留閱讀位置。',quote:'內容0。',sentenceIds:['s0'],inactiveAnchors:[],version:1,deleted:false,reanchorRequired:false,createdAt:'',updatedAt:''};
export function Prototype() {
  const [panel,setPanel]=useState<string|null>(null), [tab,setTab]=useState('notes');
  const [typography,setTypography]=useState({size:18,line:1.8});
  useLayoutEffect(()=>{const header=document.querySelector('.prototype-header');if(header)document.documentElement.style.setProperty('--prototype-header',`${header.getBoundingClientRect().height}px`);},[]);
  useLayoutEffect(()=>{if(panel==='search')document.querySelector<HTMLInputElement>('.prototype-search input')?.focus();},[panel]);
  return <main className="weekly-reader prototype-reader" data-theme={new URLSearchParams(location.search).get('theme')??'light'}>
    <header className="prototype-header">{[['notes',m.myNotes],['contents',m.contents],['settings',m.typography],['search',m.search]].map(([key,label])=><button key={key} onClick={()=>setPanel(key)}>{label}</button>)}</header>
    <BulletinEbook document={documentValue} canonicalMetadata={value.document.canonicalMetadata} chapter="back"/>
    {panel&&panel!=='search'?<ReaderPrivateState wide={false} theme={new URLSearchParams(location.search).get('theme')==='dark'?'dark':'light'} messages={{...m,myNotes:panel==='notes'?m.myNotes:panel==='contents'?m.contents:m.typography}} onClose={()=>setPanel(null)}>
      {panel==='notes'?<div className="reader-notes-browser"><Tabs label={m.noteCategories} selectedKey={tab} onSelectionChange={setTab} items={[
        {id:'notes',label:m.notesTab,content:<><input type="search" aria-label={m.searchNotes} placeholder={m.searchNotes}/><button onClick={()=>{void wordPrototype().then(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='word-prototype.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);});}}>{m.exportNotes}</button><NotesPanel messages={m} notes={[note]} onJump={()=>setPanel(null)} onEdit={()=>{}} onDelete={()=>{}} onReanchor={()=>{}}/></>},
        {id:'highlights',label:m.highlightsTab,content:<><input type="search" aria-label={m.searchHighlights} placeholder={m.searchHighlights}/><p>{m.highlightsEmpty}</p></>},
        {id:'bookmarks',label:m.bookmarksTab,content:<p>{m.bookmarksTab}</p>}
      ]}/></div>:panel==='contents'?<SectionNavigator document={documentValue} messages={m} onSection={()=>setPanel(null)}/>:<ReaderTypography messages={m} value={typography} onChange={setTypography}/>}
    </ReaderPrivateState>:null}
    {panel==='search'?<Drawer title={m.search} closeLabel={m.close} isOpen onOpenChange={open=>{if(!open)setPanel(null);}}><div className="prototype-search"><ReaderSearch document={value.document} messages={m} onJump={()=>setPanel(null)} closeControl={<ReaderIconButton variant="ghost" aria-label={m.close} onPress={()=>setPanel(null)} icon={<ChevronLeft aria-hidden="true"/>}/>}/></div></Drawer>:null}
  </main>;
}
