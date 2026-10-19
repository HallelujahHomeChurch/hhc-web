import {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {BookmarksPanel, type BookmarkDraft} from './BookmarksPanel';
import {getMessages} from '@/i18n/messages';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
const m=getMessages('en').weeklyReader,document=readerFixture().document;
const bookmark={id:'a',name:'Saved 😀',sentenceId:'s0',offset:1,pageId:'p0',documentRevision:1,version:2,deleted:false,reanchorRequired:false,createdAt:'',updatedAt:''};
function props(){return{document,messages:m,bookmarks:[bookmark],offline:false,supported:true,busy:false,cacheWarning:false,draft:null as BookmarkDraft|null,onDraft:vi.fn(),onCurrent:()=>({sentenceId:'s0',offset:1,pageId:'p0'}),onSave:vi.fn(),onJump:vi.fn(),onDelete:vi.fn()};}
it('keeps confirmed bookmarks readable offline while refusing every write',()=>{const p=props();render(<BookmarksPanel {...p} offline/>);expect(screen.getByText(m.bookmarkOffline)).toBeInTheDocument();expect(screen.getByRole('button',{name:m.bookmarkAdd})).toBeDisabled();expect(screen.getByRole('button',{name:m.bookmarkRename})).toBeDisabled();expect(screen.getByRole('button',{name:m.noteDelete})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:m.noteJump}));expect(p.onJump).toHaveBeenCalledWith(bookmark);});
it('does not infer capability from an old cached collection and keeps invalid revision positions visible',()=>{const p=props();render(<BookmarksPanel {...p} supported={false} bookmarks={[{...bookmark,reanchorRequired:true}]}/>);expect(screen.getByText(m.bookmarkUnavailable)).toBeInTheDocument();expect(screen.getByText(m.bookmarkNeedsPosition)).toBeInTheDocument();expect(screen.getByRole('button',{name:m.noteJump})).toBeDisabled();expect(screen.getByRole('button',{name:m.bookmarkAdd})).toBeDisabled();});
it('counts Unicode names, requires an exact position, and preserves a cloud-delete conflict',()=>{
 const p=props();function Controlled(){const[draft,setDraft]=useState<BookmarkDraft|null>({kind:'create',id:'new',name:'😀'.repeat(80),originalName:'',target:null});return <BookmarksPanel {...p} draft={draft} onDraft={setDraft}/>;}render(<Controlled/>);
 expect(screen.getByText('80 / 80')).toBeInTheDocument();expect(screen.getByRole('button',{name:m.noteSave})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:m.bookmarkUseCurrent}));expect(screen.getByRole('button',{name:m.noteSave})).toBeEnabled();fireEvent.change(screen.getByRole('textbox'),{target:{value:'😀'.repeat(81)}});expect(screen.getByRole('button',{name:m.noteSave})).toBeDisabled();expect(screen.getByRole('textbox')).toHaveValue('😀'.repeat(81));
});
it('offers only cloud retention for a deleted bookmark, never silent recreation',()=>{const p=props();render(<BookmarksPanel {...p} draft={{kind:'rename',id:bookmark.id,name:'Local',originalName:bookmark.name,target:bookmark,baseVersion:2,conflict:{...bookmark,deleted:true,name:''},error:m.bookmarkConflict}}/>);expect(screen.getByText(m.bookmarkDeleted)).toBeInTheDocument();expect(screen.queryByRole('button',{name:m.noteLocal})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:m.noteSave})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:m.noteCloud}));expect(p.onDraft).toHaveBeenCalledWith(null);});

it('restores focus to the initiating action after cancel and an acknowledged form dismissal',()=>{
 const p=props();function Controlled(){const[draft,setDraft]=useState<BookmarkDraft|null>(null);return <BookmarksPanel {...p} draft={draft} onDraft={setDraft} onSave={()=>setDraft(null)}/>;}render(<Controlled/>);
 const rename=screen.getByRole('button',{name:m.bookmarkRename});fireEvent.click(rename);expect(screen.getByRole('textbox')).toHaveFocus();fireEvent.click(screen.getByRole('button',{name:m.noteCancel}));expect(rename).toHaveFocus();
 const add=screen.getByRole('button',{name:m.bookmarkAdd});fireEvent.click(add);fireEvent.click(screen.getByRole('button',{name:m.noteSave}));expect(add).toHaveFocus();
});

it('restores focus after the hundredth bookmark and an asynchronous busy dismissal',()=>{
 const p=props(),draft:BookmarkDraft={kind:'create',id:'new',name:'Hundred',originalName:'',target:bookmark};
 const bookmarks=Array.from({length:99},(_,i)=>({...bookmark,id:String(i)}));
 const {rerender}=render(<BookmarksPanel {...p} bookmarks={bookmarks} draft={draft}/>);
 rerender(<BookmarksPanel {...p} bookmarks={[...bookmarks,{...bookmark,id:'new'}]} draft={null} busy/>);
 rerender(<BookmarksPanel {...p} bookmarks={[...bookmarks,{...bookmark,id:'new'}]} draft={null}/>);
 expect(screen.getByRole('button',{name:m.bookmarkAdd})).toBeDisabled();expect(screen.getAllByRole('button',{name:m.bookmarkRename})[0]).toHaveFocus();
});
