import {expect, it} from 'vitest';
import type {BulletinReaderMutation, BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {readerFixture} from './test-fixture';
import {bookmarkTargets, exactBookmarkTarget} from './bookmarks';
import {readReaderReturn, saveReaderReturn} from './return-state';
import {rebaseReaderMutations, manualReaderRecovery} from './rebase';
it('requires an exact sentence/scalar/source page and never accepts a component fallback', () => {
 const doc=readerFixture().document;doc.content.layoutManifest.pages[0].slots[0].fragments[0].end=2;doc.content.layoutManifest.pages[1].slots[0].fragments.push({sentenceId:'s0',start:2,end:4});
 expect(exactBookmarkTarget(doc,{kind:'sentence',id:'s0',start:2,page:0})).toBeNull();
 expect(exactBookmarkTarget(doc,{kind:'sentence',id:'s0',start:2,page:1})).toEqual({sentenceId:'s0',offset:2,pageId:'p1'});
 expect(exactBookmarkTarget(doc,{kind:'component',id:'c0',page:0})).toBeNull();
 expect(exactBookmarkTarget(doc,{kind:'sentence',id:'s0',start:4,page:1})).toBeNull();
 expect(bookmarkTargets(doc)).toContainEqual({sentenceId:'s0',offset:2,pageId:'p1'});
});
it('recognizes every bookmark return action while refusing automatic rebase or note recovery', () => {
 const value=readerFixture(),binding={accountId:'account-a',documentId:value.document.documentId};
 const state:BulletinReaderState={...binding,appliedRevision:1,currentRevision:1,highlights:[],notes:[],progress:null,conflicts:[],bookmarks:[]};
 const common={mutationId:'bookmark-action',documentRevision:1,createdAt:new Date().toISOString()};
 const mutations:BulletinReaderMutation[]=[{...common,kind:'createBookmark',payload:{bookmarkId:'id',name:'😀',sentenceId:'s0',offset:1,pageId:'p0'}},{...common,kind:'renameBookmark',baseVersion:1,payload:{bookmarkId:'id',name:'new'}},{...common,kind:'deleteBookmark',baseVersion:1,payload:{bookmarkId:'id'}},{...common,kind:'reanchorBookmark',baseVersion:1,payload:{bookmarkId:'id',sentenceId:'s0',offset:1,pageId:'p0'}}];
 for(const mutation of mutations){saveReaderReturn(binding,{revision:1,action:mutation});expect(readReaderReturn(binding)?.action).toEqual(mutation);expect(rebaseReaderMutations([mutation],state,state,[])).toMatchObject({mutations:[],recovery:[{mutationId:mutation.mutationId}]});expect(()=>manualReaderRecovery(mutation,state,value.document,{sentenceIds:['s0'],text:'no note',color:'red'})).toThrow('bookmark_requires_explicit_rebind');}
});
