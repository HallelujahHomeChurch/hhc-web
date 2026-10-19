import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import type {BulletinReaderState} from '@hallelujahhomechurch/hhc-web-client';
import {webcrypto} from 'node:crypto';
import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {activateOfflineAccount} from '@/features/weekly-reader/offline-store';
import userEvent from '@testing-library/user-event';
import {readFileSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
import {WeeklyReader} from './WeeklyReader';
import {saveReaderReturn} from '@/features/weekly-reader/return-state';
import {applyLocalMutation} from '@/features/weekly-reader/private-state';
import {writeTabs, readTabs} from '@/features/weekly-reader/workspace';

const bulletinCss = ['bulletin-paper.css', 'bulletin-paper-v2.css', 'bulletin-paper-v7.css', 'bulletin-ebook.css'].map(file => readFileSync(new URL(import.meta.resolve(`@hallelujahhomechurch/ui/${file}`)), 'utf8')).join('\n');

const state = vi.hoisted(() => ({accountId: 'account-a' as string | null, status: 'authenticated', open: vi.fn(), renew: vi.fn(), signIn: vi.fn(), privateState: vi.fn(), mutate: vi.fn()}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => state.accountId, useAccountAuth: () => ({status: state.status}),
  useAccountSignIn: () => state.signIn,
  useBulletinAccess: () => ({status: 'available', editions: state.accountId ? [{series: 'general', locale: 'zh-Hant'}, {series: 'general', locale: 'zh-Hans'}] : []}),
  useBulletinAuthorization: () => authorization
}));
const authorization = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};
beforeEach(() => {
  vi.useFakeTimers({toFake: ['Date']});
  vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
});
function selectText(element: Element, start?: number, end?: number, finish = true) {
  fireEvent.pointerDown(element);
  const range = document.createRange();
  range.selectNodeContents(element);
  if (start !== undefined) {
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
    range.setStart(text, start); range.setEnd(text, end!);
  }
  const selection = window.getSelection()!;
  selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  if (finish) fireEvent.pointerUp(element);
}
vi.mock('@/features/weekly-reader/api', async original => ({...await original<typeof import('@/features/weekly-reader/api')>(), createReaderApi: () => ({open: state.open, renew: state.renew, privateState: state.privateState, mutate: state.mutate})}));
const props = {locale: 'en' as const, issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const, messages: getMessages('en').weeklyReader};
async function choosePage(page: number) {
  const contents = screen.queryByRole('button', {name: props.messages.contents});
  fireEvent.click(contents ?? screen.getByRole('button', {name: 'Thumbnails'}));
  if (contents) fireEvent.click(screen.getByText(props.messages.originalPages, {selector: 'summary'}));
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: `Page ${page}`}));});
}
function chooseDirection(name: string) {
  fireEvent.click(screen.getByRole('button', {name: /^Reading direction/}));
  expect(document.querySelector('.reader-viewport')).toHaveAttribute('data-direction', name === 'Horizontal paging' ? 'horizontal' : 'vertical');
}
beforeEach(() => {vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'); state.accountId = 'account-a'; state.status = 'authenticated'; state.open.mockReset().mockResolvedValue(readerFixture()); state.renew.mockReset().mockResolvedValue(readerFixture()); state.privateState.mockReset().mockResolvedValue({state: {accountId: 'account-a', documentId: readerFixture().document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []}}); state.mutate.mockReset(); sessionStorage.clear(); vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})));});
afterEach(() => {cleanup(); Reflect.deleteProperty(document, 'fonts'); Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect'); Reflect.deleteProperty(Range.prototype, 'getClientRects'); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers();});
beforeEach(() => {Object.defineProperty(Range.prototype, 'getBoundingClientRect', {configurable: true, value: () => new DOMRect(0, 100, 300, 20)});});

describe('protected weekly reader', () => {
  it('keeps content-free header chrome during account checking', () => {
    state.accountId = null; state.status = 'checking';
    const {container} = render(<WeeklyReader {...props}/>);
    expect(container.querySelector('.reader-tabbar')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(props.messages.loading);
    expect(container.querySelector('[data-sentence-id]')).toBeNull();
    expect(state.open).not.toHaveBeenCalled();
  });
  it('background authorization validation preserves usable content without a loading message', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    expect(container.querySelector('.reader-loading-shell[data-overlay]')).toBeNull();
    expect(container.querySelector('.reader-document')?.closest('[inert]')).toBeNull();
    expect(screen.getByText('Private weekly')).toBeInTheDocument();
    await act(async () => finish(readerFixture()));
    expect(container.querySelector('.reader-loading-shell[data-overlay]')).toBeNull();
  });
  it('keeps initial My Notes loading inside the fixed panel without a false empty list', async () => {
    const cloud = (await state.privateState()).state;
    saveReaderReturn({accountId: 'account-a', documentId: cloud.documentId}, {revision: 1, action: {mutationId: 'restored-bookmark', kind: 'createBookmark', documentRevision: 1, createdAt: new Date().toISOString(), payload: {bookmarkId: 'waiting-bookmark', name: 'Place', sentenceId: 's0', offset: 0, pageId: 'p0'}}});
    let finish!: (response: {state: typeof cloud}) => void;
    state.privateState.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    render(<WeeklyReader {...props}/>);
    const panel = await screen.findByRole('dialog', {name: props.messages.myNotes});
    expect(within(panel).getByRole('status')).toHaveTextContent(props.messages.loading);
    expect(within(panel).queryByText(props.messages.noteEmpty)).not.toBeInTheDocument();
    await act(async () => finish({state: cloud}));
    fireEvent.click(within(panel).getByRole('tab', {name: props.messages.notesTab}));
    expect(within(panel).getByText(props.messages.noteEmpty)).toBeInTheDocument();
  });
  it('document fetch retains header chrome without exposing bulletin text', async () => {
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(state.open).toHaveBeenCalledOnce());
    expect(container.querySelector('.reader-tabbar')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(props.messages.loading);
    expect(container.querySelector('[data-sentence-id]')).toBeNull();
    await act(async () => finish(readerFixture()));
  });
  it.each(['cancel', 'confirm'])('exit dialog can %s while authorization revalidation is pending', async action => {
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByRole('button', {name: props.messages.home}));
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    const dialog = await screen.findByRole('dialog', {name: props.messages.exitTitle});
    fireEvent.click(within(dialog).getByRole('button', {name: action === 'cancel' ? props.messages.keepReading : props.messages.exitConfirm}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: props.messages.exitTitle})).not.toBeInTheDocument());
    await act(async () => finish(readerFixture()));
  });
  it.each(['button', 'backdrop'])('home cancel by %s preserves position and dirty draft without native confirm', async cancel => {
    const value = readerFixture();
    saveReaderReturn({accountId: 'account-a', documentId: value.document.documentId}, {revision: 1, pageId: 'p2', draft: {text: 'Keep my unsaved draft'}});
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(element: HTMLElement) {if (element.classList.contains('reader-document')) this.callback([{contentRect: {width: 1200}} as ResizeObserverEntry], this as unknown as ResizeObserver);}
      disconnect() {}
    });
    const {container} = render(<WeeklyReader {...props}/>);
    const textbox = await screen.findByRole('textbox', {name: props.messages.noteText});
    const pageBefore = container.querySelector('[data-active-page]')?.getAttribute('data-active-page');
    fireEvent.click(screen.getByRole('button', {name: props.messages.home}));
    const dialog = await screen.findByRole('dialog', {name: props.messages.exitTitle});
    expect(dialog).toHaveTextContent(props.messages.noteDiscardConfirm);
    expect(nativeConfirm).not.toHaveBeenCalled();
    if (cancel === 'backdrop') await userEvent.click(dialog.closest('.hhc-modal-overlay')!);
    else fireEvent.click(within(dialog).getByRole('button', {name: props.messages.keepReading}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: props.messages.exitTitle})).not.toBeInTheDocument());
    expect(textbox).toHaveValue('Keep my unsaved draft');
    expect(container.querySelector('[data-active-page]')?.getAttribute('data-active-page')).toBe(pageBefore);
  });
  it('search jump survives validation between pointerdown and click without a second tap', async () => {
    vi.stubGlobal('matchMedia', vi.fn(query => ({matches: query === '(max-width: 767px)', addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    fireEvent.click(screen.getByRole('button', {name: props.messages.search}));
    fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容2'}});
    fireEvent.submit(screen.getByRole('search'));
    const result = within(screen.getByRole('list')).getAllByRole('button')[0];
    vi.spyOn(result, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 100));
    const pointer = (type: string) => {
      const event = new MouseEvent(type, {bubbles: true, clientX: 40, clientY: 40, button: 0});
      Object.defineProperties(event, {pointerId: {value: 1}, isPrimary: {value: true}, pointerType: {value: 'touch'}});
      fireEvent(result, event);
    };
    pointer('pointerdown');
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    expect(container.querySelector('.reader-document')!.closest('[hidden]')).toBeNull();
    expect(container.querySelector('.reader-document')!.closest('[inert]')).toBeNull();
    expect(container.querySelector('.reader-loading')).toBeNull();
    pointer('pointerup');
    fireEvent.click(result);
    await act(async () => finish(readerFixture()));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: props.messages.search})).not.toBeInTheDocument());
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2');
    expect(state.open).toHaveBeenCalledTimes(2);
  });
  it('ordinary search jump does not request a receipt', async () => {
    render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.search}));});
    fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容2'}});
    fireEvent.submit(screen.getByRole('search'));
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: /內容2/}));});
    expect(screen.queryByRole('dialog', {name: props.messages.search})).not.toBeInTheDocument();
    expect(state.open).toHaveBeenCalledOnce();
  });
  it('toggles mobile sentences, dismisses from distant blank space and persists non-contiguous whole-sentence highlights', async () => {
    vi.stubGlobal('matchMedia', vi.fn(query => ({matches: query === '(max-width: 767px)', addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const cloud = (await state.privateState()).state;
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
    const first = container.querySelector('[data-sentence-id="s0"]')!;
    const last = container.querySelector('[data-sentence-id="s3"]')!;
    expect(first).toHaveAttribute('role', 'button');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(first);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    fireEvent.click(first);
    fireEvent.click(container.querySelector('.reader-viewport')!);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    fireEvent.click(last); fireEvent.click(first);
    fireEvent.click(screen.getByRole('button', {name: 'Blue highlight'}));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0].payload).toEqual({sentenceIds: ['s0', 's3'], color: 'blue'});
  });
  it.each(([
    ['zh-Hant',1440],['zh-Hans',1440],['zh-Hant',1024],['zh-Hans',1024],['zh-Hant',390],['zh-Hans',390],
  ] as const).flatMap(([locale,width])=>(['v6','v7','v8','v9','v10'] as const).map(version=>[locale,width,version] as const)))('reads %s at width %i with %s, unchanged source anchors and independent theme',async(contentLocale,width,rendererVersion)=>{
    const mobile=width<768;
    vi.stubGlobal('matchMedia',vi.fn(query=>({matches:query==='(max-width: 767px)'&&mobile,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
    vi.stubGlobal('ResizeObserver',class{
      constructor(private callback:ResizeObserverCallback){}
      observe(element:Element){this.callback([{target:element,contentRect:{width,height:800}} as ResizeObserverEntry],this as unknown as ResizeObserver);}
      disconnect(){}
    });
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
      if(this.classList.contains('reader-tabbar'))return new DOMRect(0,76,width,52);
      return this.classList.contains('reader-viewport')?new DOMRect(0,128,width,600):new DOMRect(0,500,300,30);
    });
    Object.defineProperty(Range.prototype,'getBoundingClientRect',{configurable:true,value:()=>new DOMRect(0,500,300,30)});
    const fixture=readerFixture(contentLocale,rendererVersion);
    const first=fixture.document.content.components[0],second=fixture.document.content.components[1];
    if(first.type!=='backSummary'||second.type!=='backSummary')throw new Error('fixture');
    const welcome=first.items[0].blocks[0],paragraph=second.items[0].blocks[0];
    paragraph.sentences[0].spans[0].fontRole='emphasis';
    const credit={...paragraph,id:'credit',sentences:[{id:'credit-sentence',spans:[{text:'Production credit',fontRole:'body' as const}]}]};
    fixture.document.content.components[0]={id:'c0',type:'cover',cover:{welcome:[welcome],worship:[],work:[],wordQuestions:[],weeklyVerses:[]}};
    fixture.document.content.components[1]={id:'c1',type:'bodySection',bodySection:{kind:'sermon',title:{...paragraph,id:'article-title',sentences:[{id:'article-heading',spans:[{text:'Article',fontRole:'body'}]}]},header:{lectureDate:credit,contributors:[]},blocks:[paragraph]}};
    const rows=['v9','v10'].includes(rendererVersion)?(contentLocale==='zh-Hans'?[
      ['visionMission','异象使命：遍地华人兴起、福音传到地极'],['visionFellowship','团契行动：共同生活、爱与成全、恩膏传承'],['visionCommitment','坚持理想：宣教主导、灵恩神学、团队事奉、门徒训练'],
    ] as const:[
      ['visionMission','異象使命：遍地華人興起、福音傳到地極'],['visionFellowship','團契行動：共同生活、愛與成全、恩膏傳承'],['visionCommitment','堅持理想：宣教主導、靈恩神學、團隊事奉、門徒訓練'],
    ] as const):contentLocale==='zh-Hans'?[
      ['historicalVision','一个异象：合一与宣教'],['historicalGospelGoals','两个目标：福音为华人、华人为福音'],['historicalActions','三个行动：共同生活、爱与成全、恩膏传承'],['historicalCommitment','四个坚持：宣教主导、灵恩神学、团队事奉、门徒训练'],
    ] as const:[
      ['historicalVision','一個異象：合一與宣教'],['historicalGoals','兩個目標：宣教為中國、中國為宣教'],['historicalActions','三個行動：共同生活、愛與成全、恩膏傳承'],['historicalCommitment','四個堅持：宣教主導、靈恩神學、團隊事奉、門徒訓練'],
    ] as const;
    fixture.document.content.layoutManifest.pages[0].fixedSlots=rows.map(([element],index)=>({id:element,element,style:{...welcome.style,fontSize:9.6,lineHeight:12},box:{x:.422+index*.0336,y:.1465+index*.019,width:.48-index*.0336,height:.02}}));
    fixture.document.content.layoutManifest.pages[1].slots.push({...fixture.document.content.layoutManifest.pages[1].slots[0],id:'credit-slot',blockId:'credit',fragments:[{sentenceId:'credit-sentence',start:0,end:17}]});
    const original=JSON.stringify(fixture);
    state.open.mockResolvedValue(fixture);
    const cloud=(await state.privateState()).state;
    state.privateState.mockResolvedValue({state:{...cloud,documentId:fixture.document.documentId}});
    const previousTheme=localStorage.getItem('hhc-reader-theme');
    localStorage.removeItem('hhc-reader-theme');document.documentElement.dataset.theme='light';
    try{
      const {container}=render(<><style>{bulletinCss}</style><WeeklyReader {...props} contentLocale={contentLocale}/></>);
      await waitFor(()=>expect(container.querySelector(`[data-bulletin-mode="${mobile?'mobile':'paper'}"]`)).not.toBeNull());
      const paper=container.querySelector('.reader-paper-with-notes')!;
      if(!mobile)expect(paper.querySelector('.reader-scaled-page')).toHaveAttribute('data-reader-renderer',rendererVersion);
      for(const [,text] of rows)expect(within(paper as HTMLElement).getByText(text)).toBeInTheDocument();
      if(mobile){
        for(const element of ['welcomeLabel','worshipLabel','workLabel','wordLabel'])expect(paper.querySelector(`[data-fixed-element="${element}"]`)?.textContent).not.toMatch(/[：:]\s*$/);
        expect(paper.querySelector('[data-sentence-id="credit-sentence"]')).toBeNull();
      }
      await choosePage(2);
      await waitFor(()=>expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page','p1'));
      const anchor=paper.querySelector('[data-sentence-id="s1"]');
      expect(anchor).toHaveTextContent('內容1。');expect(anchor).toHaveAttribute('data-fragment-start','0');expect(anchor).toHaveAttribute('data-fragment-end','4');
      if(['v7','v8','v9','v10'].includes(rendererVersion)){
        const emphasis=anchor!.querySelector<HTMLElement>('[data-font-role="emphasis"]')!;
        expect(emphasis.style.fontFamily).toContain('HHC Weekly Serif');
        expect(emphasis.style.fontFamily).not.toContain('Kai');
        expect(getComputedStyle(emphasis).fontWeight).toBe('700');
      }
      expect(screen.queryByRole('complementary',{name:props.messages.contents})).not.toBeInTheDocument();
      if(mobile){
        expect(container.querySelector('[data-chapter="body"]')).toBeInTheDocument();
        expect(container.querySelector('[data-chapter="cover"]')).toBeNull();
        expect(container.querySelector('[data-sentence-id="credit-sentence"]')).toBeNull();
        await waitFor(()=>expect(container.querySelector('.reader-viewport')!.scrollTop).toBeGreaterThanOrEqual(364));
      }
      fireEvent.click(screen.getByRole('button',{name:props.messages.darkMode}));
      expect(container.querySelector('.weekly-reader')).toHaveAttribute('data-theme','dark');
      expect(document.documentElement).toHaveAttribute('data-theme','light');
      expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page','p1');
      expect(JSON.stringify(fixture)).toBe(original);
    }finally{
      if(previousTheme===null)localStorage.removeItem('hhc-reader-theme');else localStorage.setItem('hhc-reader-theme',previousTheme);
    }
  });
  it('relinks an unavailable note through the existing private-state API without replacing its text', async () => {
    const cloud = (await state.privateState()).state;
    const note = {id: 'note-a', text: 'Keep my note', quote: 'Original source', sentenceIds: [], inactiveAnchors: [], version: 3, deleted: false, reanchorRequired: true, createdAt: '', updatedAt: ''};
    state.privateState.mockResolvedValue({state: {...cloud, notes: [note]}});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, notes: [{...note, version: 4, sentenceIds: ['s1'], reanchorRequired: false}]}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button', {name: 'My notes'}));
    fireEvent.click(screen.getByRole('button', {name: props.messages.noteReanchor}));
    const save = screen.getByRole('button', {name: 'Save'});
    expect(save).toBeDisabled();
    selectText(document.querySelector('.reader-recovery-text [data-sentence-id="s1"]')!, 1, 3);
    fireEvent.pointerDown(save); fireEvent.click(save);
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'reanchorNote', baseVersion: 3, payload: {noteId: 'note-a', sentenceIds: ['s1'], ranges: [{sentenceId: 's1', start: 1, end: 3}]}});
    expect(state.mutate.mock.calls[0][2][0].payload).not.toHaveProperty('text');
    await waitFor(() => expect(screen.queryByRole('button', {name: props.messages.noteReanchor})).not.toBeInTheDocument());
    expect(screen.getByText('Keep my note')).toBeInTheDocument();
  });
  it('switches the reader theme without changing the website or active document', async () => {
    localStorage.removeItem('hhc-reader-theme');
    document.documentElement.dataset.theme = 'light';
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    const page = container.querySelector('[data-active-page]')?.getAttribute('data-active-page');
    fireEvent.click(screen.getByRole('button', {name: props.messages.darkMode}));
    expect(container.querySelector('.weekly-reader')).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('hhc-reader-theme')).toBe('dark');
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', page);
    fireEvent.click(screen.getByRole('button', {name: props.messages.lightMode}));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    localStorage.removeItem('hhc-reader-theme');
  });
  it.each(['speaker', 'chapter', 'chapter-reordered', 'next', 'page', 'search', 'resume', 'resume-cover', 'pull', 'pull-selection', 'pull-pinch'])('switches mobile chapters via %s while preserving source anchors', async route => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {configurable: true, value: () => new DOMRect(0, 500, 300, 30)});
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const fixture = readerFixture();
    const blocks = fixture.document.content.components.map(component => component.type === 'backSummary' ? component.items[0].blocks[0] : null!);
    fixture.document.content.components = [
      {id: 'c0', type: 'cover', cover: {welcome: [blocks[0]], worship: [], work: [], wordQuestions: [], weeklyVerses: []}},
      {id: 'c1', type: 'bodySection', bodySection: {kind: 'sermon', title: {...blocks[1], id: 'body-title', sentences: [{id: 'body-heading', spans: [{text: 'Article', fontRole: 'body'}]}]}, blocks: [blocks[1]]}},
      {id: 'c2', type: 'hymnLyrics', hymnLyrics: {hymns: [{id: 'song', title: blocks[2], sections: []}]}},
      fixture.document.content.components[3],
    ];
    const body = fixture.document.content.components[1];
    if (body.type === 'bodySection') body.bodySection.header = {lectureDate: {...blocks[1], id: 'credit', sentences: [{id: 'credit-sentence', spans: [{text: 'Production date', fontRole: 'body'}]}]}, contributors: []};
    const slot = fixture.document.content.layoutManifest.pages[1].slots[0];
    fixture.document.content.layoutManifest.pages[1].slots.unshift({...slot, id: 'credit-slot', blockId: 'credit', fragments: [{sentenceId: 'credit-sentence', start: 0, end: 15}]});
    if (route === 'speaker' && body.type === 'bodySection') {
      body.bodySection.contributors=[{role:'speaker',name:{...blocks[1],id:'speaker-name',sentences:[{id:'speaker-name-sentence',spans:[{text:'Speaker A',fontRole:'body'}]}]}}];
      fixture.document.content.layoutManifest.pages[1].slots.push({...slot,id:'body-heading-slot',blockId:'body-title',fragments:[{sentenceId:'body-heading',start:0,end:7}]});
    }
    if (route === 'chapter-reordered') fixture.document.content.layoutManifest.pages.reverse();
    state.open.mockResolvedValue(fixture);
    if (route === 'resume' || route === 'resume-cover') {
      const cloud = (await state.privateState()).state;
      if (route === 'resume-cover') for (const page of fixture.document.content.layoutManifest.pages.slice(0, 2)) page.fixedSlots = [{id: `${page.pageId}-title`, element: 'title', box: {x: 0, y: 0, width: 1, height: .1}, style: blocks[0].style}];
      state.privateState.mockResolvedValue({state: {...cloud, progress: {pageId: 'p1', sentenceId: route === 'resume-cover' ? 'canonical-title' : 's1', recordedAt: '', updatedAt: ''}}});
    }
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(container.querySelector('[data-bulletin-mode="mobile"]')).not.toBeNull());
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    if (route !== 'resume') {
      expect(container.querySelector('[data-chapter="cover"] [data-sentence-id="s0"]')).toBeInTheDocument();
      expect(container.querySelector('[data-chapter="cover"] [data-sentence-id="s1"]')).toBeNull();
    }
    if (route.startsWith('chapter') || route === 'resume-cover') {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      expect(screen.queryByRole('button', {name: props.messages.productionDetails})).not.toBeInTheDocument();
      expect(container.querySelector('.reader-chapter-title')).toBeNull();
      await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.contents}));});
      await act(async () => {fireEvent.click(within(screen.getByRole('navigation', {name: props.messages.chapters})).getByRole('button', {name: props.messages.chapterBody}));});
    }
    if (route === 'speaker') {
      await act(async () => {fireEvent.click(screen.getByRole('button',{name:props.messages.contents}));});
      await act(async () => {fireEvent.click(within(screen.getByRole('navigation',{name:props.messages.chapters})).getByRole('button',{name:props.messages.chapterWorship}));});
      await act(async () => {fireEvent.click(screen.getByRole('button',{name:props.messages.contents}));});
      await act(async () => {fireEvent.click(screen.getByText(props.messages.speakers,{selector:'summary'}));});
      await act(async () => {fireEvent.click(screen.getByRole('button',{name:'Speaker A'}));});
      expect(screen.queryByRole('dialog',{name:props.messages.contents})).not.toBeInTheDocument();
      expect(sessionStorage.getItem(`weekly-reader-position:account-a:${fixture.document.documentId}:1:anchor`)).toBe(JSON.stringify({kind:'sentence',id:'body-heading'}));
    }
    if (route === 'page') await choosePage(2);
    if (route === 'next') {
      container.querySelector('.reader-viewport')!.scrollTop = 600;
      await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.next}));});
    }
    if (route.startsWith('pull')) {
      const viewport = container.querySelector('.reader-viewport')!;
      Object.defineProperties(viewport, {scrollHeight: {value: 1000}, clientHeight: {value: 400}, scrollTop: {value: 600, writable: true}});
      const text = container.querySelector('[data-sentence-id="s0"]')!;
      const touch = (y: number) => ({identifier: 1, clientX: 100, clientY: y});
      fireEvent.pointerDown(text, {pointerType: 'touch', pointerId: 1});
      fireEvent.touchStart(text, {touches: [touch(200)]});
      if (route === 'pull-selection') {
        const range = document.createRange(); range.selectNodeContents(text);
        window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
        expect(window.getSelection()!.toString()).toBe('內容0。');
        fireEvent(document, new Event('selectionchange'));
      }
      if (route === 'pull-pinch') fireEvent.touchStart(text, {touches: [touch(200), {...touch(210), identifier: 2}]});
      fireEvent.touchMove(text, {touches: [touch(100)]});
      fireEvent.touchEnd(text, {touches: [], changedTouches: [touch(100)]});
      fireEvent.pointerUp(text, {pointerType: 'touch', pointerId: 1});
      {
        expect(container.querySelector('[data-chapter="cover"]')).toBeInTheDocument();
        expect(container.querySelector('[data-chapter="body"]')).toBeNull();
        fireEvent.keyDown(document, {key: 'Escape'});
        await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.next}));});
      }
    }
    if (route === 'search') {
      await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.search}));});
      fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容1'}});
      fireEvent.submit(screen.getByRole('search'));
      await act(async () => {fireEvent.click(within(screen.getByRole('dialog', {name: props.messages.search})).getByRole('button', {name: /內容[12]/}));});
    }
    await waitFor(() => expect(container.querySelector('[data-chapter="body"] [data-sentence-id="s1"]')).toBeInTheDocument());
    if (route.startsWith('chapter')) expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
    expect(container.querySelector('[data-sentence-id="credit-sentence"]')).toBeNull();
    expect(container.querySelector('[data-chapter="cover"]')).toBeNull();
    expect(container.querySelector('[data-chapter="worship"]')).toBeNull();
    if (route === 'next') {
      const viewport = container.querySelector('.reader-viewport')!;
      Object.defineProperties(viewport, {scrollHeight: {value: 1000}, clientHeight: {value: 400}});
      await waitFor(() => expect(viewport.scrollTop).toBe(0));
      viewport.scrollTop = 900;
      await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.previous}));});
      expect(container.querySelector('[data-chapter="cover"]')).toBeInTheDocument();
      await waitFor(() => expect(viewport.scrollTop).toBe(0));
      await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.next}));});
    }
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.next}));});
    expect(container.querySelector('[data-chapter="worship"] [data-sentence-id="s2"]')).toBeInTheDocument();
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.next}));});
    expect(screen.queryByRole('button', {name: props.messages.next})).not.toBeInTheDocument();
    expect(container.querySelector('.reader-chapter-actions')).toBeNull();
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.contents}));});
    await act(async () => {fireEvent.click(within(screen.getByRole('navigation', {name: props.messages.chapters})).getByRole('button', {name: props.messages.chapterWorship}));});
    expect(container.querySelector('[data-chapter="worship"]')).toBeInTheDocument();
  });
  it('reveals mobile chrome on a settled tap and keeps it visible until another scroll gesture', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    const root = container.querySelector('.reader-viewport')!, shell = container.querySelector('.reader-document')!;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    fireEvent.wheel(root); root.scrollTop = 400; fireEvent.scroll(root);
    await waitFor(() => expect(shell).toHaveAttribute('data-mobile-hidden', 'true'));
    fireEvent.pointerDown(root); fireEvent.pointerUp(root); fireEvent.click(root);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(shell).toHaveAttribute('data-mobile-hidden', 'false');
    root.scrollTop = 420; fireEvent.scroll(root);
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(shell).toHaveAttribute('data-mobile-hidden', 'false');
    fireEvent.touchMove(root); root.scrollTop = 450; fireEvent.scroll(root);
    await waitFor(() => expect(shell).toHaveAttribute('data-mobile-hidden', 'true'));
  });
  it('suppresses the native context menu on reader paper, not on note inputs', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    const text = container.querySelector('[data-sentence-id="s0"]')!;
    expect(fireEvent.contextMenu(text)).toBe(false);
    fireEvent.click(screen.getByRole('button', {name: props.messages.myNotes}));
    await screen.findByRole('dialog', {name: props.messages.myNotes});
    expect(fireEvent.contextMenu(screen.getByRole('dialog', {name: props.messages.myNotes}))).toBe(true);
  });
  it('allows keyboard users to clear an existing exact highlight range', async () => {
    const cloud = (await state.privateState()).state;
    const highlights = [{sentenceId: 's0', quote: '內容0。', color: 'yellow', active: true, version: 1, updatedAt: '', segments: [{start: 1, end: 3, color: 'yellow'}]}];
    state.privateState.mockResolvedValue({state: {...cloud, highlights}});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, highlights: []}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    render(<WeeklyReader {...props}/>);
    const trigger = await screen.findByRole('button', {name: 'My notes'});
    await waitFor(() => expect(trigger).not.toBeDisabled());
    const user = userEvent.setup();
    trigger.focus(); await user.keyboard('{Enter}');
    const tab = await screen.findByRole('tab', {name: props.messages.highlightsTab});
    tab.focus(); await user.keyboard('{Enter}');
    const list = await screen.findByRole('region', {name: 'Highlights'});
    expect(within(list).getByText('容0')).toBeInTheDocument();
    const control = within(list).getByRole('button', {name: props.messages.clearHighlight});
    control.focus(); await user.keyboard('{Enter}');
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'clearHighlight', payload: {sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 1, end: 3}]}});
    expect(within(list).queryByText('容0')).not.toBeInTheDocument();
  });
  it('records the first mobile sentence below the chrome, not the obscured sentence', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('reader-viewport')) return new DOMRect(0, 128, 390, 600);
      if (this.classList.contains('reader-tabbar')) return new DOMRect(0, 76, 390, 52);
      if (this.dataset.sentenceId === 's0') return new DOMRect(0, 90, 300, 30);
      if (this.dataset.sentenceId === 's1') return new DOMRect(0, 150, 300, 30);
      return new DOMRect(0, 900, 300, 30);
    });
    const cloud = (await state.privateState()).state;
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    fireEvent.scroll(document.querySelector('.reader-viewport')!);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'setProgress', payload: {pageId: 'p1', sentenceId: 's1'}});
  });
  it('announces the current reading direction after each toggle', async () => {
    render(<WeeklyReader {...props}/>);
    const toggle = await screen.findByRole('button', {name: 'Reading direction: Vertical scrolling'});
    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName('Reading direction: Horizontal paging');
    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName('Reading direction: Vertical scrolling');
  });
  it.each(['page', 'search', 'resume'])('positions mobile %s below measured chrome', async mode => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('reader-tabbar')) return new DOMRect(0, 76, 390, 52);
      return this.classList.contains('reader-viewport') ? new DOMRect(0, 128, 390, 600) : new DOMRect(0, 500, 300, 30);
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {configurable: true, value: () => new DOMRect(0, 500, 300, 30)});
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    if (mode === 'resume') {
      const cloud = (await state.privateState()).state;
      state.privateState.mockResolvedValue({state: {...cloud, progress: {pageId: 'p2', sentenceId: 's2', recordedAt: '', updatedAt: ''}}});
    }
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(container.querySelector('[data-bulletin-mode="mobile"]')).not.toBeNull());
    if (mode === 'page') await choosePage(3);
    if (mode === 'search') {
      await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.search}));});
      fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容2'}});
      fireEvent.submit(screen.getByRole('search'));
      await act(async () => {fireEvent.click(within(screen.getByRole('dialog', {name: props.messages.search})).getByRole('button', {name: /內容[12]/}));});
      expect(screen.queryByRole('dialog', {name: props.messages.search})).not.toBeInTheDocument();
    }
    await waitFor(() => expect(container.querySelector('.reader-viewport')!.scrollTop).toBeGreaterThanOrEqual(364));
    expect(scroll).not.toHaveBeenCalled();
  });
  it('preserves a stale restored draft and asks for a merge without sending its obsolete CAS', async () => {
    const fixture = readerFixture(), cloud = (await state.privateState()).state;
    const note = {id: 'note-a', sentenceIds: ['s0'], text: 'Cloud text', quote: 'Original quotation', version: 4, deleted: false, inactiveAnchors: ['s0'], reanchorRequired: true, createdAt: '', updatedAt: ''};
    saveReaderReturn({accountId: 'account-a', documentId: fixture.document.documentId}, {revision: 1, draft: {noteId: 'note-a', baseVersion: 2, text: 'My unsaved edit'}});
    state.privateState.mockResolvedValue({state: {...cloud, notes: [note]}});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, notes: [note]}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    render(<WeeklyReader {...props}/>);
    expect(await screen.findByText('Original quotation')).toBeInTheDocument();
    expect(screen.getByText(props.messages.noteRemoved)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('My unsaved edit');
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: props.messages.noteSave}));
    expect(await screen.findByText(props.messages.noteConflict)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('My unsaved edit');
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it('keeps a missing existing note draft readable without offering create or save', async () => {
    saveReaderReturn({accountId: 'account-a', documentId: readerFixture().document.documentId}, {revision: 1, draft: {noteId: 'missing', baseVersion: 1, text: 'Do not discard'}});
    render(<WeeklyReader {...props}/>);
    expect(await screen.findByText(props.messages.noteDeleted)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('Do not discard');
    expect(screen.queryByRole('button', {name: props.messages.noteSave})).not.toBeInTheDocument();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it('shows annotation actions only after releasing the selection gesture', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence, 0, 2, false);
    expect(screen.queryByRole('button', {name: 'Yellow highlight'})).not.toBeInTheDocument();
    fireEvent.pointerUp(sentence);
    expect(screen.getByRole('button', {name: 'Yellow highlight'})).toBeInTheDocument();
    selectText(sentence, 0, 3, false);
    expect(screen.queryByRole('button', {name: 'Yellow highlight'})).not.toBeInTheDocument();
    fireEvent.pointerUp(document.body);
    expect(screen.getByRole('button', {name: 'Yellow highlight'})).toBeInTheDocument();
  });
  it('keeps in-flight progress out of recovery chrome and opens thumbnails directly', async () => {
    state.mutate.mockReturnValue(new Promise(() => {}));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', {name: 'Thumbnails'}));
    fireEvent.click(screen.getByRole('button', {name: 'Page 2'}));
    expect(screen.queryByRole('complementary', {name: 'Thumbnails'})).not.toBeInTheDocument();
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(screen.queryByText(props.messages.confirmRetryHelp)).not.toBeInTheDocument();
    expect(container.querySelector('.reader-recovery')).toBeNull();
    expect(screen.queryByRole('button', {name: props.messages.syncSyncing})).not.toBeInTheDocument();
  });
  it.each(['hide', 'home'])('settles continuous paper position on %s and clears an older search anchor', async exit => {
    const fixture = readerFixture(), key = `weekly-reader-position:account-a:${fixture.document.documentId}:1`;
    sessionStorage.setItem(`${key}:anchor`, JSON.stringify({kind: 'sentence', id: 's0'}));
    const cloud = (await state.privateState()).state;
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(sessionStorage.getItem(key)).toBe('p0'));
    const viewport = container.querySelector('.reader-viewport')!;
    for (const element of container.querySelectorAll<HTMLElement>('[data-paper-index]')) {
      const index = Number(element.dataset.paperIndex);
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, (index - 2) * 800, 500, 800));
    }
    fireEvent.scroll(viewport);
    if (exit === 'hide') {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
    } else {
      fireEvent.click(screen.getByRole('button', {name: 'Bulletin library'}));
      fireEvent.click(within(await screen.findByRole('dialog', {name: props.messages.exitTitle})).getByRole('button', {name: props.messages.exitConfirm}));
    }
    await waitFor(() => expect(state.mutate).toHaveBeenCalled(), {timeout: 150});
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'setProgress', payload: {pageId: 'p2'}});
    expect(sessionStorage.getItem(`${key}:anchor`)).toBeNull();
    expect(sessionStorage.getItem(key)).toBe('p2');
  });
  it('starts continuous and switches direction without losing the current source page', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelectorAll('[data-paper-index]')).toHaveLength(4));
    await choosePage(2);
    expect(screen.queryByRole('button', {name: 'Horizontal paging'})).not.toBeInTheDocument();
    chooseDirection('Horizontal paging');
    expect(container.querySelectorAll('[data-paper-index]')).toHaveLength(1);
    expect(container.querySelector('[data-paper-index]')).toHaveAttribute('data-paper-index', '1');
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
    chooseDirection('Vertical scrolling');
    expect(container.querySelectorAll('[data-paper-index]')).toHaveLength(4);
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
  });
  it('exposes the library, document tab and tools without an overflow menu', async () => {
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(screen.getByRole('button', {name: 'Bulletin library'})).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: 'Open bulletins'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: props.messages.search}).closest('.reader-tabbar')).not.toBeNull();
    expect(screen.queryByRole('button', {name: 'More options'})).not.toBeInTheDocument();
  });
  it('protects a dirty note when leaving through Home or closing the active bulletin', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(element: Element) {this.callback([{target: element, contentRect: {width: 1200, height: 800}} as ResizeObserverEntry], this as unknown as ResizeObserver);}
      disconnect() {}
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Unsaved draft'}});
    fireEvent.click(screen.getByRole('button', {name: 'Bulletin library'}));
    const homeDialog = await screen.findByRole('dialog', {name: props.messages.exitTitle});
    expect(homeDialog).toHaveTextContent(props.messages.noteDiscardConfirm);
    fireEvent.click(within(homeDialog).getByRole('button', {name: props.messages.keepReading}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: props.messages.exitTitle})).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', {name: /Close bulletin/}));
    const closeDialog = await screen.findByRole('dialog', {name: props.messages.exitTitle});
    expect(closeDialog).toHaveTextContent(props.messages.noteDiscardConfirm);
    fireEvent.click(within(closeDialog).getByRole('button', {name: props.messages.keepReading}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: props.messages.exitTitle})).not.toBeInTheDocument());
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('Unsaved draft');
  });
  it('selects partial native text instead of activating an entire sentence on click', async () => {
    const cloud = (await state.privateState()).state;
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    fireEvent.click(sentence);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    expect(sentence).not.toHaveAttribute('role', 'button');
    selectText(sentence, 1, 3);
    fireEvent.click(screen.getByRole('button', {name: 'Blue highlight'}));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0].payload).toEqual({sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 1, end: 3}], color: 'blue'});
  });
  it('keeps a new note exact anchor when the viewport crosses the mobile breakpoint', async () => {
    const listeners = new Map<string, (event: {matches: boolean}) => void>();
    const queries = new Map<string, {matches: boolean}>();
    vi.stubGlobal('matchMedia', vi.fn(query => {
      const media = {matches: false, addEventListener: (_event: string, listener: (event: {matches: boolean}) => void) => listeners.set(query, listener), removeEventListener: vi.fn()};
      queries.set(query, media); return media;
    }));
    const cloud = (await state.privateState()).state;
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!, 1, 3);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Keep exact anchor'}});
    act(() => {const query = queries.get('(max-width: 767px)')!; query.matches = true; listeners.get('(max-width: 767px)')!(query);});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0].payload).toMatchObject({text: 'Keep exact anchor', sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 1, end: 3}]});
  });
  it('dismisses transient selection outside the reader without removing a saved highlight', async () => {
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, highlights: [{sentenceId: 's0', color: 'yellow', quote: '內容0', active: true, version: 1, updatedAt: ''}]}});
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    expect(sentence).toHaveAttribute('data-highlight', 'yellow');
    expect(state.mutate).not.toHaveBeenCalled();
    selectText(sentence);
    fireEvent.click(screen.getByText('Private weekly', {selector: 'h1'}));
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
  });

  it('closes the toolbar immediately, preserving the optimistic highlight until acknowledgement', async () => {
    Object.defineProperty(Range.prototype, 'getClientRects', {configurable: true, value: () => [new DOMRect(0, 100, 300, 20)]});
    const cloud = (await state.privateState()).state;
    let acknowledge!: () => void;
    state.mutate.mockImplementation((_selector, _value, mutations) => new Promise(resolve => {
      acknowledge = () => resolve({state: {...cloud, highlights: [{sentenceId: 's0', color: 'yellow', quote: '內容0', active: true, version: 1, updatedAt: ''}]}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]});
    }));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    const color = screen.getByRole('button', {name: 'Yellow highlight'});
    fireEvent.pointerDown(color);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    fireEvent.click(color);
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'));
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-reader-highlight="yellow"]')).not.toBeNull());
    await act(async () => acknowledge());
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    expect(sentence).toHaveAttribute('data-highlight', 'yellow');
  });

  it('retains retry context after a failed highlight and does not discard an open note on outside click', async () => {
    Object.defineProperty(Range.prototype, 'getClientRects', {configurable: true, value: () => [new DOMRect(0, 100, 300, 20)]});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    state.mutate.mockRejectedValue(new TypeError('temporary'));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Yellow highlight'}));
    await screen.findByText(props.messages.syncUnsaved);
    expect(screen.queryByRole('button', {name: props.messages.syncAction})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-reader-highlight="yellow"]')).not.toBeNull());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Keep this draft'}});
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(screen.getByDisplayValue('Keep this draft')).toHaveValue('Keep this draft');
    expect(confirm).not.toHaveBeenCalled();
    let dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', {name: props.messages.noteContinueEditing}));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', {name: props.messages.noteDiscard}));
    await waitFor(() => expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument());
  });

  it('invalidates a snapshot when the same native gesture extends outside the reading surface', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence, 0, 2);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    const outside = document.createElement('p'); outside.textContent = 'Outside'; document.body.append(outside);
    const selection = document.getSelection()!, range = document.createRange();
    range.setStart(sentence.firstChild!.firstChild ?? sentence.firstChild!, 0); range.setEnd(outside.firstChild!, 3);
    selection.removeAllRanges(); selection.addRange(range); fireEvent(document, new Event('selectionchange'));
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    outside.remove();
  });

  it('protects a dirty note when changing pages or opening the notes list', async () => {
    const native = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
    const next = screen.getByRole('button', {name: 'Thumbnails'});
    selectText(container.querySelector('[data-sentence-id="s0"]')!, 1, 3);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    const textbox = screen.getByRole('textbox', {name: props.messages.noteText});
    fireEvent.change(textbox, {target: {value: 'Keep draft and range'}});
    fireEvent.click(next);
    let dialog = await screen.findByRole('alertdialog');
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p0');
    expect(textbox).toHaveValue('Keep draft and range');
    expect(native).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', {name: props.messages.noteContinueEditing}));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(textbox).toHaveValue('Keep draft and range');
    fireEvent.click(next); dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', {name: props.messages.noteDiscard}));
    fireEvent.click(await screen.findByRole('button', {name: 'Page 2'}));
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
    expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  });

  it('does not clear a newer selection when an older highlight acknowledgement arrives', async () => {
    const cloud = (await state.privateState()).state;
    let acknowledge!: () => void;
    state.mutate.mockImplementation((_selector, _value, mutations) => new Promise(resolve => {
      acknowledge = () => resolve({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]});
    }));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    fireEvent.click(screen.getByRole('button', {name: 'Yellow highlight'}));
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'));
    selectText(sentence); selectText(sentence);
    await act(async () => acknowledge());
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
  });

  it('keeps native pinch-zoom panning from turning the paper page', async () => {
    const visual = Object.assign(new EventTarget(), {scale: 1});
    vi.stubGlobal('visualViewport', visual);
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    chooseDirection('Horizontal paging');
    const viewport = container.querySelector('.reader-viewport')!;
    const swipe = () => {
      for (const [type, x] of [['pointerdown', 200], ['pointerup', 100]] as const) {
        const event = new Event(type, {bubbles: true});
        Object.assign(event, {pointerType: 'touch', pointerId: 1, clientX: x, clientY: 100});
        fireEvent(viewport, event);
      }
    };
    act(() => {visual.scale = 2; visual.dispatchEvent(new Event('resize'));});
    swipe();
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p0');
    act(() => {visual.scale = 1; visual.dispatchEvent(new Event('resize'));});
    swipe();
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
  });
  it('returns focus to the inline note marker after closing its associated notes', async () => {
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, notes: [{id: 'note-a', sentenceIds: ['s0'], text: 'Anchored note', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''}]}});
    render(<WeeklyReader {...props}/>);
    const marker = await screen.findByRole('button', {name: 'My notes (1)'});
    marker.focus(); fireEvent.click(marker);
    expect(await screen.findByText('Anchored note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    await waitFor(() => expect(marker).toHaveFocus());
  });
  it('restores same-account selection and note draft after login without sending a write', async () => {
    const first = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(first.container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Return after login'}});
    first.unmount();
    const second = render(<WeeklyReader {...props}/>);
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Return after login');
    expect(state.mutate).not.toHaveBeenCalled();
    second.unmount();
    state.accountId = 'account-b';
    state.open.mockResolvedValue({...readerFixture(), access: {...readerFixture().access, accountId: 'account-b'}});
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  });
  it('preserves an unsaved note when resizing between the side panel and sheet', async () => {
    let resize!: (width: number) => void;
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: (entries: {contentRect: {width: number; height: number}}[]) => void) {}
      observe(element: HTMLElement) {if (element.className === 'reader-document') resize = width => this.callback([{contentRect: {width, height: 800}}]);}
      disconnect() {}
    });
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    act(() => resize(1300));
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Do not lose this draft'}});
    act(() => resize(800));
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Do not lose this draft');
    act(() => resize(1300));
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Do not lose this draft');
    vi.unstubAllGlobals();
  });
  it('keeps the same portal editor and draft usable during background authorization', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Unsaved private draft'}});
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent.focus(window);
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('Unsaved private draft');
    await act(async () => finish(readerFixture()));
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Unsaved private draft');
  });
  it('shows both versions after a delete conflict and never silently retries deletion', async () => {
    const local = {id: 'note-a', sentenceIds: ['s0'], text: 'Local note', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''};
    const cloud = {...local, text: 'Cloud edit', version: 2};
    const privateState = {...(await state.privateState()).state, notes: [local]};
    state.privateState.mockResolvedValue({state: privateState});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...privateState, notes: [cloud]}, results: [{mutationId: mutations[0].mutationId, status: 'note_conflict', revision: 1, note: cloud}]}));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', {name: 'My notes'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', {name: 'Delete'}));
    expect(await screen.findByText('Cloud edit')).toBeInTheDocument();
    expect(screen.getByText('Local note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Keep cloud'}));
    expect(state.mutate).toHaveBeenCalledOnce();
  });
  it.each([false, true])('records mobile progress without an initial-cover write, immediate hide: %s', async hide => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-bulletin-mode="mobile"] [data-sentence-id="s2"]')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
    expect(state.mutate).not.toHaveBeenCalled();
    for (const element of container.querySelectorAll<HTMLElement>('[data-sentence-id]')) {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({top: element.dataset.sentenceId === 's2' ? 100 : -100, bottom: element.dataset.sentenceId === 's2' ? 130 : -70} as DOMRect);
    }
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: (await state.privateState()).state, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    fireEvent.scroll(document.querySelector('.reader-viewport')!);
    if (hide) {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
      await waitFor(() => expect(state.mutate).toHaveBeenCalled(), {timeout: 150});
    }
    await waitFor(() => expect(state.mutate).toHaveBeenCalled(), {timeout: 2500});
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'setProgress', payload: {pageId: 'p2', sentenceId: 's2'}});
  });
  it('automatically restores cloud progress without asking or resetting progress', async () => {
    const cloud = {accountId: 'account-a', documentId: readerFixture().document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: {pageId: 'p2', componentId: 'c2', sentenceId: 's2', recordedAt: '', updatedAt: ''}, conflicts: []};
    state.privateState.mockResolvedValue({state: cloud});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, progress: null}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2'));
    expect(screen.queryByRole('button', {name: 'Start over'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Continue reading'})).not.toBeInTheDocument();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it('keeps selected sentences and annotation actions usable during background validation', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent.focus(window);
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', {name: 'Copy'})).toBeEnabled();
    await act(async () => finish(readerFixture()));
    await screen.findByRole('button', {name: 'Copy'});
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
  });
  it.each([{pageId: 'p2'}, {pageId: 'p2', componentId: 'c2'}, {pageId: 'p2', sentenceId: 'removed'}])('restores progress with page fallback: %j', async progress => {
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, progress}});
    const {container} = render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2'));
  });
  it('does not let late cloud progress undo manual page navigation', async () => {
    const cloud = (await state.privateState()).state;
    let finish!: (result: unknown) => void;
    state.privateState.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await choosePage(2);
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
    await waitFor(() => expect(state.privateState).toHaveBeenCalled());
    await act(async () => finish({state: {...cloud, progress: {pageId: 'p3'}}}));
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
  });
  it('keeps a locally saved first page rather than replacing it with cloud progress', async () => {
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, progress: {pageId: 'p2'}}});
    sessionStorage.setItem(`weekly-reader-position:account-a:${readerFixture().document.documentId}:1`, 'p0');
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p0');
    expect(screen.queryByRole('button', {name: 'Continue reading'})).not.toBeInTheDocument();
  });
  it('preserves native selection snapshot on note cancellation and clears it on escape and navigation', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(state.privateState).toHaveBeenCalled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    expect(screen.queryByRole('button', {name: 'Yellow highlight'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await screen.findByRole('button', {name: 'Yellow highlight'});
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    selectText(sentence);
    fireEvent.keyDown(screen.getByRole('region', {name: 'Bulletin reader'}), {key: 'Escape'});
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    selectText(sentence);
    await choosePage(2);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
  });
  it('keeps launch disabled unless explicitly enabled after acceptance', () => {
    vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', undefined);
    render(<WeeklyReader {...props}/>);
    expect(state.open).not.toHaveBeenCalled();
    expect(screen.getByText('This bulletin is unavailable.')).toBeInTheDocument();
  });
  it('searches loaded text and jumps without requesting another receipt', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByRole('button', {name: 'Search this bulletin'}));
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search this bulletin'}), {target: {value: '內容2'}});
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('button', {name: /內容2/}));
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-sentence-id', 's2'));
    expect(state.open).toHaveBeenCalledOnce();
    expect(container.querySelectorAll('[data-reader-watermark]')).toHaveLength(4);
    expect(container.querySelector('[data-reader-watermark]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain(readerFixture().access.traceCode);
  });
  it('makes the search panel modal and restores its trigger after backdrop dismissal', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    const trigger = screen.getByRole('button', {name: 'Search this bulletin'});
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', {name: 'Search this bulletin'})).toHaveAttribute('aria-modal', 'true');
    expect(container.querySelector('.reader-stage')).toHaveAttribute('inert');
    expect(container.querySelector('.reader-chrome-controls')).toHaveAttribute('inert');
    fireEvent.click(container.querySelector('.reader-panel-backdrop')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('uses the notes shell for mobile typography settings', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByRole('button', {name: props.messages.typography}));
    const dialog = screen.getByRole('dialog', {name: props.messages.typography});
    expect(dialog.closest('.hhc-modal-overlay')).toBeInTheDocument();
    expect(dialog.querySelector('.reader-private-sheet')).toBeInTheDocument();
    expect(container.querySelector('.reader-panel-backdrop')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', {name: props.messages.noteClose}));
    expect(screen.queryByRole('dialog', {name: props.messages.typography})).not.toBeInTheDocument();
  });
  it('restores a saved sentence without moving focus into the text', async () => {
    const key = `weekly-reader-position:account-a:${readerFixture().document.documentId}:1`;
    sessionStorage.setItem(key, 'p2');
    sessionStorage.setItem(`${key}:anchor`, JSON.stringify({kind: 'sentence', id: 's2'}));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2'));
    await act(async () => {await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));});
    expect(document.activeElement).not.toHaveAttribute('data-sentence-id');
  });
  it('keeps search query and result position across repeated jumps and closing the panel', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByRole('button', {name: 'Search this bulletin'}));
    fireEvent.change(screen.getByRole('searchbox'), {target: {value: '內容'}});
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('button', {name: /內容2/}));
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2');
    await userEvent.click(screen.getByRole('button', {name: 'Search this bulletin'}));
    expect(screen.getByRole('searchbox')).toHaveValue('內容');
    expect(screen.getByLabelText('Search results')).toHaveTextContent('4 search results');
  });
  it('closes mobile thumbnails after selecting the destination', async () => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {configurable: true, value: () => new DOMRect(0, 100, 100, 20)});
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: props.messages.contents}));});
    await act(async () => {fireEvent.click(screen.getByText(props.messages.originalPages, {selector: 'summary'}));});
    expect(screen.getByRole('button', {name: 'Page 4'})).toBeInTheDocument();
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Page 4'}));});
    expect(screen.queryByRole('dialog', {name: props.messages.contents})).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-sentence-id', 's3'));
  });
  it('announces font loading instead of presenting a blank paper as ready', async () => {
    let ready!: () => void;
    Object.defineProperty(document, 'fonts', {configurable: true, value: {ready: new Promise<void>(resolve => {ready = resolve;})}});
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(screen.getByText('Loading bulletin…')).toHaveAttribute('role', 'status');
    await act(async () => ready());
    expect(screen.queryByText('Loading bulletin…')).not.toBeInTheDocument();
  });
  it('font loading becomes a retryable error and ignores late completion', async () => {
    let ready!: () => void;
    Object.defineProperty(document, 'fonts', {configurable: true, value: {ready: new Promise<void>(resolve => {ready = resolve;})}});
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    vi.useFakeTimers();
    // Re-mount to put the font deadline on the fake clock.
    cleanup(); render(<WeeklyReader {...props}/>); await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(screen.getByRole('alert')).toHaveTextContent(props.messages.unavailable);
    await act(async () => ready());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: props.messages.retry})); await act(async () => {});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('shows only a login shell when anonymous', () => {
    state.accountId = null; state.status = 'anonymous';
    render(<WeeklyReader {...props}/>);
    expect(screen.queryByText('Private weekly')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}));
    expect(state.signIn).toHaveBeenCalled();
    expect(state.open).not.toHaveBeenCalled();
  });
  it('renders only the active paper page and supports thumbnails and keyboard navigation', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    chooseDirection('Horizontal paging');
    expect(container.querySelectorAll('[data-bulletin-page]')).toHaveLength(1);
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p0');
    fireEvent.click(screen.getAllByRole('button', {name: 'Next page'})[0]);
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p1');
    await choosePage(4);
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p3');
    expect(screen.queryByRole('button', {name: 'Next page'})).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('region', {name: 'Bulletin reader'}), {key: 'ArrowLeft'});
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2');
  });
  it('discards a late response after account switch', async () => {
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;})).mockResolvedValueOnce({...readerFixture(), access: {...readerFixture().access, accountId: 'account-b'}});
    const {rerender} = render(<WeeklyReader {...props}/>);
    state.accountId = 'account-b'; rerender(<WeeklyReader {...props}/>);
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    await act(async () => finish(readerFixture()));
    expect(state.open.mock.calls[0][2].aborted).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('reflows all mobile sections without fixed pages or zoom controls', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-bulletin-mode="mobile"]')).not.toBeNull());
    expect(container.querySelectorAll('[data-bulletin-page]')).toHaveLength(0);
    expect(screen.queryByRole('button', {name: 'Next page'})).not.toBeInTheDocument();
    expect(container.querySelector('.reader-topbar button[aria-label="Next page"]')).toBeNull();
    expect(container.querySelectorAll('[data-sentence-id]')).toHaveLength(4);
    expect(screen.queryByRole('button', {name: 'Reading direction'})).not.toBeInTheDocument();
    await choosePage(3);
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2');
    expect(screen.queryByRole('complementary', {name: 'Thumbnails'})).not.toBeInTheDocument();
  });
  it('supports backward mobile chapters and reserves note space only in the note chapter', async () => {
    vi.stubGlobal('matchMedia', vi.fn(query => ({matches: query === '(max-width: 767px)', addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const fixture = readerFixture();
    const first = fixture.document.content.components[0];
    if (first.type !== 'backSummary') throw new Error('fixture');
    fixture.document.content.components[0] = {id: first.id, type: 'cover', cover: {welcome: first.items[0].blocks, worship: [], work: [], wordQuestions: [], weeklyVerses: []}};
    state.open.mockResolvedValue(fixture);
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, notes: [{id: 'back-note', sentenceIds: ['s3'], text: 'Note', quote: '內容3。', version: 1, deleted: false, createdAt: '', updatedAt: ''}]}});
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-chapter="cover"]')).not.toBeNull());
    expect(container.querySelector('.reader-paper-with-notes')).not.toHaveAttribute('data-has-notes');
    expect(screen.queryByRole('button', {name: props.messages.previous})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: props.messages.next}));
    await waitFor(() => expect(container.querySelector('[data-chapter="back"]')).not.toBeNull());
    await waitFor(() => expect(container.querySelector('.reader-paper-with-notes')).toHaveAttribute('data-has-notes'));
    expect(screen.queryByRole('button', {name: props.messages.next})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: props.messages.previous}));
    await waitFor(() => expect(container.querySelector('[data-chapter="cover"]')).not.toBeNull());
    expect(container.querySelector('.reader-paper-with-notes')).not.toHaveAttribute('data-has-notes');
  });
  it('collapses production credits in mobile views without removing article text or stored anchors', async () => {
    vi.stubGlobal('matchMedia', vi.fn(query => ({matches: query === '(max-width: 767px)', addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const fixture = readerFixture();
    const first = fixture.document.content.components[0];
    if (first.type !== 'backSummary') throw new Error('fixture');
    const title = first.items[0].blocks[0];
    const credit = {...title, id: 'credit-block', sentences: [{id: 'credit-sentence', spans: [{text: 'Production credit', fontRole: 'body' as const}]}]};
    const date = {...title, id: 'lecture-date', sentences: [{id: 'date-sentence', spans: [{text: '2026-09-20', fontRole: 'body' as const}]}]};
    fixture.document.content.components[0] = {id: 'c0', type: 'bodySection', bodySection: {kind: 'sermon', title, header: {lectureDate: date, contributors: [{role: 'editor', name: credit}]}, blocks: []}};
    fixture.document.content.layoutManifest.pages[0].slots.push({...fixture.document.content.layoutManifest.pages[0].slots[0], id: 'credit-slot', blockId: 'credit-block', fragments: [{sentenceId: 'credit-sentence', start: 0, end: 17}]});
    state.open.mockResolvedValue(fixture);
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-bulletin-mode="mobile"]')).not.toBeNull());
    expect(container.querySelector('[data-sentence-id="s0"]')).toHaveTextContent('內容0。');
    expect(screen.queryByText('Production credit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Speaker and production details'})).not.toBeInTheDocument();
    expect(fixture.document.content.components[0].bodySection?.header?.contributors).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: props.messages.search}));
    fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'Production credit'}});
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByLabelText(props.messages.searchResults)).toHaveTextContent(props.messages.noResults);
    expect(container.querySelector('[data-sentence-id="credit-sentence"]')).toBeNull();
  });
  it('restores the bound revision page and makes thumbnail copies inert', async () => {
    sessionStorage.setItem(`weekly-reader-position:account-a:${readerFixture().document.documentId}:1`, 'p2');
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p2'));
    fireEvent.click(screen.getByRole('button', {name: 'Thumbnails'}));
    expect(container.querySelectorAll('[inert][aria-hidden="true"]')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', {name: 'Page 1'}));
    expect(container.querySelector('[data-active-page]')).toHaveAttribute('data-active-page', 'p0');
    expect(sessionStorage.getItem(`weekly-reader-position:account-a:${readerFixture().document.documentId}:1`)).toBe('p0');
  });
  it('persists a section anchor and restores it only within the same account/revision', async () => {
    const fixture = readerFixture();
    const section = fixture.document.content.components[2];
    if (section.type !== 'backSummary') throw new Error('fixture');
    fixture.document.content.components[2] = {id: section.id, type: 'bodySection', bodySection: {kind: 'unknown', title: section.items[0].blocks[0], blocks: []}};
    state.open.mockResolvedValue(fixture);
    const key = `weekly-reader-position:account-a:${fixture.document.documentId}:1:anchor`;
    const {unmount} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByRole('button', {name: 'Thumbnails'}));
    fireEvent.click(screen.getByText('Sections', {selector: 'summary'}));
    fireEvent.click(screen.getByRole('button', {name: '內容2。'}));
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify({kind: 'sentence', id: 's2'}));
    unmount();
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    scroll.mockRestore();
  });
  it('retries failures with the same issuance ID and never renders failed content', async () => {
    state.open.mockRejectedValueOnce(new Error('temporary'));
    render(<WeeklyReader {...props}/>);
    await screen.findByRole('alert');
    expect(screen.queryByText('Private weekly')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await screen.findByText('Private weekly');
    expect(state.open.mock.calls[0][1].clientRequestId).toBe(state.open.mock.calls[1][1].clientRequestId);
  });
});
it.each(['save', 'delete'] as const)('accepts the first note %s while background progress is in flight', async kind => {
  const note = {id: 'note-a', sentenceIds: ['s0'], text: 'Original note', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''};
  const cloud = {...(await state.privateState()).state, notes: [note]};
  state.privateState.mockResolvedValue({state: cloud});
  let release!: () => void, inFlight = 0, peak = 0;
  state.mutate.mockImplementation(async (_selector, _value, mutations) => {
    inFlight++; peak = Math.max(peak, inFlight);
    const mutation = mutations[0];
    if (mutation.kind === 'setProgress') await new Promise<void>(resolve => {release = resolve;});
    inFlight--;
    return {state: mutation.kind === 'setProgress' ? cloud : {...cloud, notes: [{...note, text: 'Changed once', version: 2, deleted: kind === 'delete'}]}, results: [{mutationId: mutation.mutationId, status: 'applied', revision: 1}]};
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
  await choosePage(2);
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', {name: 'My notes'}));
  if (kind === 'save') {
    fireEvent.click(screen.getByRole('button', {name: 'Edit'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Changed once'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  } else {fireEvent.click(screen.getByRole('button', {name: 'Delete'})); fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', {name: 'Delete'}));}
  expect(screen.queryByText(props.messages.operationWaiting)).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  expect(state.mutate).toHaveBeenCalledOnce();
  await act(async () => release());
  await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(2));
  expect(state.mutate.mock.calls[1][2][0]).toMatchObject({kind: kind === 'save' ? 'editNote' : 'deleteNote', baseVersion: 1, payload: {noteId: note.id}});
  expect(peak).toBe(1);
  await waitFor(() => expect(screen.queryByText(props.messages.operationWaiting)).not.toBeInTheDocument());
});
it('keeps a newer draft when retrying an older note and keeps retry reachable inside the notes drawer', async () => {
  const value = readerFixture();
  const note = {id: 'note-a', sentenceIds: ['s0'], text: 'Cloud baseline', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''};
  const cloud = {...(await state.privateState()).state, notes: [note]};
  state.privateState.mockResolvedValue({state: cloud});
  const mutation = {mutationId: 'old-note-save', documentRevision: 1, createdAt: new Date().toISOString(), kind: 'editNote' as const, baseVersion: 1, payload: {noteId: note.id, text: 'Older submitted text'}};
  saveReaderReturn({accountId: 'account-a', documentId: value.document.documentId}, {revision: 1, draft: {noteId: note.id, baseVersion: 1, text: mutation.payload.text}, action: mutation});
  state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, notes: [{...note, text: mutation.payload.text, version: 2}]}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('textbox', {name: props.messages.noteText})).not.toHaveAttribute('readonly'));
  const textbox = screen.getByRole('textbox', {name: props.messages.noteText});
  fireEvent.change(textbox, {target: {value: 'A newer draft to keep'}});
  const retry = screen.getByRole('button', {name: props.messages.confirmRetry});
  expect(retry.closest('.reader-private-sheet,.reader-private-panel')).not.toBeNull();
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry);
  await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('A newer draft to keep');
  expect(state.mutate.mock.calls[0][2]).toEqual([mutation]);
});

it('protects a manual delete-conflict merge before any further typing and saves against the cloud baseline', async () => {
  const note = {id: 'note-a', sentenceIds: ['s0'], text: 'Local note', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''};
  const cloudNote = {...note, text: 'Cloud edit', version: 2};
  const cloud = {...(await state.privateState()).state, notes: [note]};
  state.privateState.mockResolvedValue({state: cloud});
  state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, notes: [cloudNote]}, results: [{mutationId: mutations[0].mutationId, status: mutations[0].kind === 'deleteNote' ? 'note_conflict' : 'applied', revision: 1, note: cloudNote}]}));
  const native = vi.spyOn(window, 'confirm');
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'My notes'}));
  fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
  let dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', {name: 'Delete'}));
  fireEvent.click(await screen.findByRole('button', {name: 'Merge manually'}));
  const merged = 'Cloud edit\n\nLocal note';
  expect(screen.getByRole('textbox', {name: 'Note'})).toHaveValue(merged);
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent(props.messages.noteDiscardConfirm);
  fireEvent.click(within(dialog).getByRole('button', {name: props.messages.noteContinueEditing}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', {name: 'Note'})).toHaveValue(merged);
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
  await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(2));
  expect(state.mutate.mock.calls[1][2][0]).toMatchObject({kind: 'editNote', baseVersion: 2, payload: {noteId: note.id, text: merged}});
  expect(native).not.toHaveBeenCalled();
});

it('closes a clean bulletin without waiting for a background progress acknowledgement', async () => {
  const current = {issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
  writeTabs('account-a', [current, {...current, issueNumber: 1740}]);
  const cloud = (await state.privateState()).state;
  let finish!: () => void;
  state.mutate.mockImplementation((_selector, _value, mutations) => new Promise(resolve => {finish = () => resolve({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]});}));
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).toBeEnabled());
  await screen.findByRole('button', {name: /Close bulletin.*1740/});
  await choosePage(2);
  fireEvent.click(screen.getByRole('button', {name: /Close bulletin.*1739/}));
  await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
  await waitFor(() => expect(readTabs('account-a').map(tab => tab.issueNumber)).toEqual([1740]));
  await act(async () => finish());
  expect(readTabs('account-a').map(tab => tab.issueNumber)).toEqual([1740]);
});
it('shows a local notes-load error and retries without changing the document', async () => {
  state.privateState.mockRejectedValueOnce(new TypeError('notes network failure'));
  const {container} = render(<WeeklyReader {...props}/>);
  expect(await screen.findByText(props.messages.notesLoadError)).toBeInTheDocument();
  const paper = container.querySelector('[data-bulletin-page]');
  await waitFor(() => expect(screen.getByRole('button', {name: props.messages.retry})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.retry}));
  await waitFor(() => expect(screen.queryByText(props.messages.notesLoadError)).not.toBeInTheDocument());
  expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled();
  expect(container.querySelector('[data-bulletin-page]')).toBe(paper);
  expect(state.open).toHaveBeenCalledOnce();
});

it.each([false,true])('separates reading mode from the device shell (mobile=%s)', async mobile => {
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:mobile,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const {container}=render(<WeeklyReader {...props}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());
  const shell=container.querySelector('.reader-document')!;
  expect(shell).toHaveAttribute('data-reading-mode',mobile?'easy':'paper');
  fireEvent.click(screen.getByRole('button',{name:props.messages.typography}));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:mobile?props.messages.paperMode:props.messages.easyMode})));
  expect(shell).toHaveAttribute('data-reading-mode',mobile?'paper':'easy');
  expect(shell.hasAttribute('data-mobile')).toBe(mobile);
  expect(container.querySelector('[data-bulletin-mode="mobile"]')!==null).toBe(!mobile);
  const key=`weekly-reader-position:account-a:${readerFixture().document.documentId}:1:mode`;
  expect(sessionStorage.getItem(key)).toBe(mobile?'paper':'easy');
  expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:props.messages.close}));
  const event=new KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true});
  shell.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
});

it('keeps a dirty note and mode when closing is cancelled', async()=>{
  const {container}=render(<WeeklyReader {...props}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());
  selectText(container.querySelector('[data-sentence-id="s0"]')!);
  fireEvent.click(screen.getByRole('button',{name:props.messages.addNote}));
  fireEvent.change(screen.getByRole('textbox',{name:props.messages.noteText}),{target:{value:'draft'}});
  fireEvent.click(screen.getByRole('button',{name:props.messages.noteCancel}));
  fireEvent.click(await screen.findByRole('button',{name:props.messages.noteContinueEditing}));
  expect(screen.getByRole('textbox',{name:props.messages.noteText})).toHaveValue('draft');
  expect(container.querySelector('.reader-document')).toHaveAttribute('data-reading-mode','paper');
});

it('exposes mobile paper sentence keyboard semantics without toggling twice', async()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 const {container}=render(<WeeklyReader {...props}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:props.messages.typography}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:props.messages.paperMode})));
 fireEvent.click(screen.getByRole('button',{name:props.messages.close}));
 const sentence=container.querySelector('[data-paper-index="0"] [data-sentence-id="s0"]')!;
 expect(sentence).toHaveAttribute('role','button');expect(sentence).toHaveAttribute('tabindex','0');
 fireEvent.keyDown(sentence,{key:'Enter'});expect(sentence).toHaveAttribute('aria-pressed','true');
 fireEvent.keyDown(sentence,{key:' '});expect(sentence).toHaveAttribute('aria-pressed','false');
});

it('does not expose legacy annotations or send a history mutation when opening My Notes', async () => {
  const cloud = {accountId: 'account-a', documentId: readerFixture().document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: [], highlightHistory: [{id: 'history', highlight: {sentenceId: 'old', quote: 'Historical quote', color: 'red', active: false, version: 1, updatedAt: ''}}]};
  state.privateState.mockResolvedValue({state: cloud});
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.myNotes}));
  expect(screen.queryByRole('tab', {name: props.messages.historyTab})).not.toBeInTheDocument();
  expect(screen.queryByText('Historical quote')).not.toBeInTheDocument();
  expect(state.mutate).not.toHaveBeenCalled(); expect(cloud.highlightHistory).toHaveLength(1);
});

it('keeps export modal keyboard navigation separate from horizontal reader paging', async () => {
 const cloud=(await state.privateState()).state;
 const note={id:'export-note',text:'Own text',quote:'source',sentenceIds:['s0'],inactiveAnchors:[],version:1,deleted:false,reanchorRequired:false,createdAt:'',updatedAt:''};
 state.privateState.mockResolvedValue({state:{...cloud,notes:[note]}});
 render(<WeeklyReader {...props}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());
 chooseDirection('Horizontal paging');
 fireEvent.click(screen.getByRole('button',{name:props.messages.myNotes}));
 const exportButton=await screen.findByRole('button',{name:props.messages.exportNotes});
 await waitFor(()=>expect(exportButton).toBeEnabled());fireEvent.click(exportButton);
 const modal=await screen.findByRole('dialog',{name:props.messages.exportNotes});
 const prepare=within(modal).getByRole('button',{name:props.messages.exportPrepare});
 for(const key of ['PageDown','PageUp','ArrowRight','ArrowLeft']) {fireEvent.keyDown(prepare,{key});expect(modal).toBeInTheDocument();}
 expect(state.mutate).not.toHaveBeenCalled();
});

it('keeps bookmark drafts across tab unmounts and confirms dirty close with the house dialog',async()=>{
 const cloud=(await state.privateState()).state;state.privateState.mockResolvedValue({state:{...cloud,bookmarks:[]}});
 render(<WeeklyReader {...props}/>);await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:props.messages.myNotes}));fireEvent.click(await screen.findByRole('tab',{name:props.messages.bookmarksTab}));fireEvent.click(screen.getByRole('button',{name:props.messages.bookmarkAdd}));fireEvent.change(screen.getByRole('textbox',{name:props.messages.bookmarkName}),{target:{value:'Keep unsaved bookmark'}});
 fireEvent.click(screen.getByRole('tab',{name:props.messages.notesTab}));fireEvent.click(screen.getByRole('tab',{name:props.messages.bookmarksTab}));expect(screen.getByRole('textbox',{name:props.messages.bookmarkName})).toHaveValue('Keep unsaved bookmark');
 fireEvent.click(screen.getByRole('button',{name:props.messages.noteClose}));const dialog=await screen.findByRole('alertdialog');expect(dialog).toHaveTextContent(props.messages.noteDiscardConfirm);fireEvent.click(within(dialog).getByRole('button',{name:props.messages.noteContinueEditing}));expect(screen.getByRole('textbox',{name:props.messages.bookmarkName})).toHaveValue('Keep unsaved bookmark');expect(state.mutate).not.toHaveBeenCalled();
});
it('creates a named bookmark with an exact source target through the existing private executor',async()=>{
 const cloud=(await state.privateState()).state;state.privateState.mockResolvedValue({state:{...cloud,bookmarks:[]}});
 state.mutate.mockImplementation(async(_selector,_value,mutations)=>{const m=mutations[0],b={id:m.payload.bookmarkId,name:m.payload.name,sentenceId:m.payload.sentenceId,offset:m.payload.offset,pageId:m.payload.pageId,documentRevision:1,version:1,deleted:false,reanchorRequired:false,createdAt:'',updatedAt:''};return{state:{...cloud,bookmarks:[b]},results:[{mutationId:m.mutationId,status:'applied',revision:1,bookmark:b}]};});
 render(<WeeklyReader {...props}/>);await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:props.messages.myNotes}));fireEvent.click(await screen.findByRole('tab',{name:props.messages.bookmarksTab}));fireEvent.click(screen.getByRole('button',{name:props.messages.bookmarkAdd}));fireEvent.change(screen.getByRole('textbox',{name:props.messages.bookmarkName}),{target:{value:'My place'}});fireEvent.change(screen.getByRole('combobox',{name:props.messages.bookmarkPosition}),{target:{value:JSON.stringify({sentenceId:'s0',offset:0,pageId:'p0'})}});fireEvent.click(screen.getByRole('button',{name:props.messages.noteSave}));
 await waitFor(()=>expect(state.mutate).toHaveBeenCalledOnce());expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind:'createBookmark',payload:{name:'My place',sentenceId:'s0',offset:0,pageId:'p0'}});await waitFor(()=>expect(screen.queryByRole('textbox',{name:props.messages.bookmarkName})).not.toBeInTheDocument());expect(screen.getByText('My place')).toBeInTheDocument();
});

it('preserves a hidden bookmark draft when saving an ordinary note after switching tabs',async()=>{
 const cloud=(await state.privateState()).state,note={id:'n',text:'Original',quote:'Source',sentenceIds:['s0'],inactiveAnchors:[],version:1,deleted:false,reanchorRequired:false,createdAt:'',updatedAt:''};state.privateState.mockResolvedValue({state:{...cloud,notes:[note],bookmarks:[]}});
 state.mutate.mockImplementation(async(_s,_v,mutations)=>({state:{...cloud,notes:[{...note,text:mutations[0].payload.text,version:2}],bookmarks:[]},results:[{mutationId:mutations[0].mutationId,status:'applied',revision:1}]}));
 render(<WeeklyReader {...props}/>);await waitFor(()=>expect(screen.getByRole('button',{name:props.messages.myNotes})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:props.messages.myNotes}));fireEvent.click(await screen.findByRole('tab',{name:props.messages.bookmarksTab}));fireEvent.click(screen.getByRole('button',{name:props.messages.bookmarkAdd}));fireEvent.change(screen.getByRole('textbox',{name:props.messages.bookmarkName}),{target:{value:'Keep bookmark draft'}});fireEvent.click(screen.getByRole('tab',{name:props.messages.notesTab}));fireEvent.click(screen.getByRole('button',{name:props.messages.noteEdit}));fireEvent.change(screen.getByRole('textbox',{name:props.messages.noteText}),{target:{value:'Changed note'}});fireEvent.click(screen.getByRole('button',{name:props.messages.noteSave}));
 await waitFor(()=>expect(screen.getByRole('textbox',{name:props.messages.bookmarkName})).toHaveValue('Keep bookmark draft'));expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind:'editNote'});
});


it.each([false, true])('closes the editor on the first Save and retains a single edit with focus refresh=%s', async refresh => {
  const value = readerFixture();
  const note = {id: 'n', text: 'Original', quote: '內容0。', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const cloud = {accountId: 'account-a', documentId: value.document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [note], progress: null, conflicts: []};
  state.privateState.mockResolvedValue({state: cloud});
  let finish!: () => void;
  state.mutate.mockImplementation((_selector, _value, writes) => writes[0].kind === 'editNote' ? new Promise(resolve => {finish = () => resolve({state: {...cloud, notes: [{...note, text: 'Changed once', version: 2}]}, results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]});}) : Promise.resolve({state: cloud, results: [{mutationId: writes[0].mutationId, status: 'applied', revision: 1}]}));
  const {container} = render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.myNotes}));
  fireEvent.click(await screen.findByRole('button', {name: props.messages.noteEdit}));
  fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Changed once'}});
  fireEvent.click(screen.getByRole('button', {name: props.messages.noteSave}));
  expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  expect(await screen.findByText('Changed once')).toBeInTheDocument();
  await waitFor(() => expect(finish).toBeDefined());
  if (refresh) {fireEvent(window, new Event('focus')); await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));}
  expect(container.querySelector('.reader-loading-shell[data-overlay]')).toBeNull();
  await act(async () => finish());
  await waitFor(() => expect(screen.getByText('Changed once')).toBeInTheDocument());
  expect(state.mutate.mock.calls.filter(call => call[2][0].kind === 'editNote')).toHaveLength(1);
  expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
});

it('retains an in-flight edit when deleting a different note, and warns before leaving two memory intents', async () => {
  const value = readerFixture();
  const a = {id: 'note-a', text: 'A original', quote: 'Quote A', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const b = {...a, id: 'note-b', text: 'B original', quote: 'Quote B', sentenceIds: ['s1']};
  let cloud: BulletinReaderState = {...(await state.privateState()).state, notes: [a, b]};
  state.privateState.mockImplementation(async () => ({state: cloud}));
  let releaseA!: () => void, releaseB!: () => void;
  state.mutate.mockImplementation(async (_selector, _value, mutations) => {
    if (mutations[0].kind === 'editNote') await new Promise<void>(resolve => {releaseA = resolve;});
    else await new Promise<void>(resolve => {releaseB = resolve;});
    cloud = applyLocalMutation(cloud, mutations[0], value.document);
    return {state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]};
  });
  render(<WeeklyReader {...props}/>); await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.myNotes}));
  const first = screen.getByText('A original').closest('article')!;
  fireEvent.click(within(first).getByRole('button', {name: props.messages.noteEdit}));
  fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'A accepted'}});
  fireEvent.click(screen.getByRole('button', {name: props.messages.noteSave}));
  await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
  expect(screen.getByText(props.messages.syncUnsaved)).toBeInTheDocument();
  fireEvent.click(within(screen.getByText('B original').closest('article')!).getByRole('button', {name: props.messages.noteDelete}));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', {name: props.messages.noteDelete}));
  await waitFor(() => expect(screen.queryByText('B original')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: props.messages.noteClose}));
  fireEvent.click(screen.getByRole('button', {name: props.messages.home}));
  const exit = await screen.findByRole('dialog', {name: props.messages.exitTitle}); expect(exit).toHaveTextContent(props.messages.exitUnsavedChanges);
  fireEvent.click(within(exit).getByRole('button', {name: props.messages.keepReading}));
  await act(async () => releaseA()); await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(2));
  expect(state.mutate.mock.calls.map(call => call[2][0].kind)).toEqual(['editNote', 'deleteNote']);
  expect(state.mutate.mock.calls[1][2][0].payload.noteId).toBe(b.id);
  await act(async () => releaseB()); await waitFor(() => expect(cloud.notes.find(note => note.id === a.id)?.text).toBe('A accepted'));
  expect(cloud.notes.find(note => note.id === b.id)?.deleted).toBe(true);
});

it('shows a persistent unsaved warning after actual IDB quota fallback while network acknowledgement is delayed', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('navigator', {onLine: true, locks: {request: async (_name: string, options: unknown, work?: () => Promise<unknown>) => typeof options === 'function' ? options() : work!()}});
  await activateOfflineAccount('account-a');
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {if (this.name === 'private') throw new DOMException('full', 'QuotaExceededError'); return put.call(this, value, key);});
  const note = {id: 'quota-note', text: 'Original', quote: 'Quote', sentenceIds: ['s0'], inactiveAnchors: [], version: 1, deleted: false, reanchorRequired: false, createdAt: '', updatedAt: ''};
  const cloud = {...(await state.privateState()).state, notes: [note]}; state.privateState.mockResolvedValue({state: cloud});
  state.mutate.mockImplementationOnce(() => new Promise(() => {}));
  render(<WeeklyReader {...props}/>); await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.myNotes})); fireEvent.click(screen.getByRole('button', {name: props.messages.noteEdit}));
  fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Quota accepted draft'}}); fireEvent.click(screen.getByRole('button', {name: props.messages.noteSave}));
  expect(await screen.findByText('Quota accepted draft')).toBeInTheDocument(); await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
  expect(screen.getByText(props.messages.syncUnsaved)).toBeVisible(); expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: props.messages.confirmRetry})).not.toBeInTheDocument();
});


it.each([false, true])('keeps contents for navigation and exposes separate settings (mobile=%s)', async mobile => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  const title = mobile ? props.messages.contents : props.messages.thumbnails;
  fireEvent.click(screen.getByRole('button', {name: title}));
  const contents = screen.getByRole('dialog', {name: title});
  expect(within(contents).queryByRole('group', {name: props.messages.readingMode})).not.toBeInTheDocument();
  expect(within(contents).queryByRole('button', {name: props.messages.fontIncrease})).not.toBeInTheDocument();
  expect(!!contents.closest('.hhc-modal-overlay')).toBe(mobile);
  fireEvent.click(within(contents).getByRole('button', {name: props.messages.close}));
  fireEvent.click(screen.getByRole('button', {name: props.messages.typography}));
  const settings = screen.getByRole('dialog', {name: props.messages.typography});
  expect(within(settings).getByRole('group', {name: props.messages.readingMode})).toBeInTheDocument();
  expect(within(settings).queryByRole('button', {name: 'Page 1'})).not.toBeInTheDocument();
});

it('focuses search during its opening gesture and keeps clear within the input', async () => {
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.search}));
  const input = screen.getByRole('searchbox');
  expect(input).toHaveFocus();
  fireEvent.change(input, {target: {value: '內容'}});
  fireEvent.click(screen.getByRole('button', {name: props.messages.clearSearch}));
  expect(input).toHaveValue(''); expect(input).toHaveFocus();
});


it('cycles desktop contents focus through visible controls without entering closed details', async () => {
  render(<WeeklyReader {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', {name: props.messages.myNotes})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: props.messages.thumbnails}));
  const dialog = screen.getByRole('dialog', {name: props.messages.thumbnails});
  const close = within(dialog).getByRole('button', {name: props.messages.close});
  const visible = [close, ...within(dialog).getAllByRole('button', {name: /^Page /}), ...dialog.querySelectorAll<HTMLElement>('summary')];
  for (const control of visible) vi.spyOn(control, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 44, 44)] as unknown as DOMRectList);
  const last = visible.at(-1)!;
  last.focus(); fireEvent.keyDown(last, {key: 'Tab'}); expect(close).toHaveFocus();
  fireEvent.keyDown(close, {key: 'Tab', shiftKey: true}); expect(last).toHaveFocus();
});
