import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act,within} from '@testing-library/react';
import {VideoComments} from './VideoComments';
import type {createMemberVideoApi} from './api';
import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';
let mobile=false;let resize:()=>void;
beforeEach(()=>{
 mobile=false;resize=()=>{};
 vi.stubGlobal('Image',class {
  onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
  set src(value:string){if(value)queueMicrotask(()=>this.onload?.());}
  decode=async()=>{};
 });
 Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({get matches(){return mobile;},addEventListener:(_name:string,fn:()=>void)=>{resize=fn;},removeEventListener:vi.fn()})});
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
});
const root={id:'root',displayName:'Alice',text:'Root',createdAt:'2026-10-17T00:00:00Z',replyCount:1,directChildCount:1,descendantReplyCount:1,revision:1,deleted:false,hidden:false,mine:false};
const reply={...root,id:'reply',parentId:'root',threadParentId:'root',directChildCount:0,descendantReplyCount:0,displayName:'Bob',text:'Reply text',replyCount:0};
function fixture(){return {comments:vi.fn().mockImplementation(async(_id,options)=>({items:options.parentId?[reply]:[root]})),createComment:vi.fn().mockResolvedValue({}),setCommentReaction:vi.fn().mockResolvedValue({likes:1,reaction:'like'})};}
it('expands server-defined reply branches independently and retains a collapsed draft',async()=>{
 const nested={...reply,id:'nested',threadParentId:'reply',text:'Nested reply'};
 const api=fixture();api.comments.mockImplementation(async(_id,options)=>({items:options.parentId==='reply'?[nested]:options.parentId?[{...reply,directChildCount:1,descendantReplyCount:1}]:[{...root,descendantReplyCount:2}]}));
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled onChanged={()=>{}}/>);
 const rootToggle=await screen.findByRole('button',{name:'2 Replies'});fireEvent.click(rootToggle);
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));
 const nestedArticle=(await screen.findByText('Nested reply')).closest('article')!;
 fireEvent.click(within(nestedArticle).getByRole('button',{name:'Reply'}));
 fireEvent.change(within(nestedArticle).getByPlaceholderText('Reply'),{target:{value:'Retained nested draft'}});
 const calls=api.comments.mock.calls.length;
 fireEvent.click(rootToggle);
 fireEvent.click(screen.getByRole('button',{name:'2 Replies'}));
 expect(within(nestedArticle).getByPlaceholderText('Reply')).toHaveValue('Retained nested draft');
 expect(api.comments).toHaveBeenCalledWith('r',expect.objectContaining({view:'threaded',parentId:'reply'}));
 expect(api.comments).toHaveBeenCalledTimes(calls);
 fireEvent.click(within(nestedArticle.querySelector('form')!).getByRole('button',{name:'Reply'}));
 await waitFor(()=>expect(api.createComment).toHaveBeenCalledWith('r',expect.objectContaining({parentId:'root',replyToId:'nested',text:'Retained nested draft'})));
});
it('keeps mobile root and thread scroll positions, drafts and the same player on Back and Close',async()=>{
 mobile=true;const api=fixture();
 const view=render(<div data-video-watch><video data-testid="player"/><VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/></div>);
 const player=screen.getByTestId('player');vi.spyOn(player,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,390,200));
 fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));
 await screen.findByText('Root',{selector:'p'});
 const content=view.container.querySelector('dialog header')!.nextElementSibling as HTMLDivElement;
 content.scrollTop=120;
 fireEvent.click(screen.getByRole('button',{name:'1 Replies'}));
 await screen.findByText('Reply text');expect(content.scrollTop).toBe(0);content.scrollTop=75;
 const input=screen.getAllByPlaceholderText('Reply').find(node=>!node.closest('[hidden]'))!;
 fireEvent.focus(input);fireEvent.change(input,{target:{value:'Thread draft'}});
 const back=screen.getByRole('button',{name:'Back to comments'});fireEvent.pointerDown(back);fireEvent.blur(input,{relatedTarget:back});
 expect(view.container.querySelector('dialog')?.style.top).toBe('0px');
 fireEvent.pointerUp(back);fireEvent.click(back);expect(content.scrollTop).toBe(120);expect(view.container.querySelector('dialog')?.style.top).toBe('200px');
 fireEvent.click(screen.getByRole('button',{name:'1 Replies'}));expect(content.scrollTop).toBe(75);
 expect(input).toHaveValue('Thread draft');
 fireEvent.click(screen.getByRole('button',{name:'Close'}));
 fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));
 expect(input).toHaveValue('Thread draft');expect(screen.getByTestId('player')).toBe(player);
});
it('rejects legacy payloads instead of guessing a tree',async()=>{
 const api=fixture();api.comments.mockResolvedValue({items:[{...root,directChildCount:undefined} as unknown as RecordingComment]});
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled onChanged={()=>{}}/>);
 await screen.findByRole('button',{name:'Retry'});expect(screen.queryByText('Root',{selector:'p'})).toBeNull();
});
it('replies to a reply within the root thread and never fetches a nested thread',async()=>{
 const api=fixture();render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));await screen.findByText('Reply text');
 const item=screen.getByText('Reply text').closest('article')!;fireEvent.click(within(item).getByRole('button',{name:'Reply'}));
 fireEvent.change(within(item).getByPlaceholderText('Reply'),{target:{value:'Answer'}});fireEvent.click(within(item.querySelector('form')!).getByRole('button',{name:'Reply'}));
 await waitFor(()=>expect(api.createComment).toHaveBeenCalledWith('r',expect.objectContaining({parentId:'root',replyToId:'reply',text:'Answer'})));
 expect(api.comments.mock.calls.some(([,options])=>options.parentId==='reply')).toBe(false);
});
it('preserves a draft across mobile close, reopen and desktop resize',async()=>{
 mobile=true;const api=fixture();render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));const input=screen.getByPlaceholderText('Add a comment');fireEvent.change(input,{target:{value:'Keep draft'}});
 fireEvent.click(screen.getByRole('button',{name:'Close'}));fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));expect(screen.getByPlaceholderText('Add a comment')).toHaveValue('Keep draft');
 await act(async()=>{mobile=false;resize();});expect(screen.getByPlaceholderText('Add a comment')).toHaveValue('Keep draft');
});
it('offers a fresh traversal after an expired top cursor rather than retrying it forever',async()=>{
 const api=fixture();api.comments.mockResolvedValueOnce({items:[root],nextCursor:'expired'}).mockRejectedValueOnce({code:'recording_comment_cursor_expired'}).mockResolvedValue({items:[root]});
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Load more'}));await screen.findByRole('status');fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(api.comments).toHaveBeenLastCalledWith('r',expect.objectContaining({cursor:undefined,refresh:true})));
});

it('refreshes reaction counts and toggles from the latest server reaction',async()=>{
 const api=fixture();api.comments.mockResolvedValueOnce({items:[{...root,likes:1,reaction:null}]}).mockResolvedValue({items:[{...root,likes:4,reaction:'like'}]});
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 await screen.findByRole('button',{name:'Like'});fireEvent.click(screen.getByRole('button',{name:'Refresh comments'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','true'));
 expect(screen.getByRole('button',{name:'Like'})).toHaveTextContent('4');
 fireEvent.click(screen.getByRole('button',{name:'Like'}));
 await waitFor(()=>expect(api.setCommentReaction).toHaveBeenCalledWith('r','root',{reaction:null}));
});

it('reconciles a local reaction when a refresh returns the original server values',async()=>{
 const api=fixture();api.comments.mockImplementation(async()=>({items:[{...root,likes:0,reaction:null}]}));
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Like'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','true'));
 fireEvent.click(screen.getByRole('button',{name:'Refresh comments'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','false'));
});

it('shows initial and reply skeletons without discarding the composer draft',async()=>{
 const api=fixture();let roots!:(value:unknown)=>void,replies!:(value:unknown)=>void;
 api.comments.mockImplementation((_id,options)=>new Promise(resolve=>{if(options.parentId)replies=resolve;else roots=resolve}));
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={2} onChanged={()=>{}}/>);
 expect(view.container.querySelector('[data-loading-layout="video-comments"]')).not.toBeNull();
 expect(screen.queryByText('No comments yet.')).not.toBeInTheDocument();
 fireEvent.change(screen.getByPlaceholderText('Add a comment'),{target:{value:'Keep draft'}});
 await waitFor(()=>expect(roots).toBeTypeOf('function'));
 await act(async()=>roots({items:[root]}));
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));
 await waitFor(()=>expect(replies).toBeTypeOf('function'));
 expect(view.container.querySelector('[data-loading-layout="video-replies"]')).not.toBeNull();
 await act(async()=>replies({items:[reply]}));
 expect(await screen.findByText('Reply text')).toBeInTheDocument();
 expect(screen.getByPlaceholderText('Add a comment')).toHaveValue('Keep draft');
 expect(view.container.querySelector('[data-loading-layout]')).toBeNull();
});

it('uses account avatars for roots and replies, falls back on failure, and retries a changed URL',async()=>{
 const api=fixture();const first='https://www.alive.org.tw/assets/avatar-v1',second='https://www.alive.org.tw/assets/avatar-v2';
 api.comments.mockImplementation(async(_id,options)=>({items:options.parentId?[{...reply,avatarUrl:first}]:[{...root,avatarUrl:first}]}));
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={2} onChanged={()=>{}}/>);
 await screen.findByText('Root',{selector:'p'});
 const avatar=()=>view.container.querySelector('article')?.querySelector('img') ?? null;
 expect(avatar()).toHaveAttribute('src',first);
 fireEvent.click(screen.getByRole('button',{name:'1 Replies'}));await screen.findByText('Reply text');
 expect(view.container.querySelectorAll('article img')).toHaveLength(2);
 fireEvent.error(avatar()!);expect(avatar()).toBeNull();
 api.comments.mockResolvedValue({items:[{...root,avatarUrl:second}]});
 fireEvent.click(screen.getByRole('button',{name:'Refresh comments'}));
 await waitFor(()=>expect(avatar()).toHaveAttribute('src',second));
});
it('does not expose an avatar for deleted comments, including stale profile payloads',async()=>{
 const api=fixture();api.comments.mockResolvedValue({items:[{...root,deleted:true,text:'',avatarUrl:'https://www.alive.org.tw/assets/private-old-avatar'}]});
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={1} onChanged={()=>{}}/>);
 await waitFor(()=>expect(view.container.querySelector('article')).not.toBeNull());
 expect(view.container.querySelector('article img')).toBeNull();
});

it('keeps cold comments in the skeleton until the avatar is decoded, without an initials flash',async()=>{
 let decoded!:()=>void;
 vi.stubGlobal('Image',class {
  onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
  set src(value:string){if(value)queueMicrotask(()=>this.onload?.());}
  decode=()=>new Promise<void>(resolve=>{decoded=resolve;});
 });
 const api=fixture();api.comments.mockResolvedValue({items:[{...root,avatarUrl:'https://www.alive.org.tw/assets/cold-avatar'}]});
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={1} onChanged={()=>{}}/>);
 await waitFor(()=>expect(decoded).toBeTypeOf('function'));
 expect(screen.queryByText('Root')).toBeNull();
 expect(view.container.querySelector('[data-loading-layout="video-comments"]')).not.toBeNull();
 await act(async()=>decoded());
 await screen.findByText('Root',{selector:'p'});
 expect(view.container.querySelector('article img')).toHaveAttribute('src','https://www.alive.org.tw/assets/cold-avatar');
});

it('keeps mounted avatars when pagination exceeds the 64-image preparation cache',async()=>{
 const api=fixture();
 const items=Array.from({length:65},(_,i)=>({...root,id:`paged-${i}`,text:`Paged comment ${i}`,replyCount:0,avatarUrl:`https://www.alive.org.tw/assets/paged-avatar-${i}`}));
 api.comments.mockResolvedValueOnce({items:items.slice(0,40),nextCursor:'second'}).mockResolvedValueOnce({items:items.slice(40)});
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={65} onChanged={()=>{}}/>);
 await screen.findByText('Paged comment 0',{selector:'p'});
 expect(view.container.querySelectorAll('article img')).toHaveLength(40);
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await screen.findByText('Paged comment 64');
 expect(view.container.querySelectorAll('article img')).toHaveLength(65);
 expect(screen.getByText('Paged comment 0',{selector:'p'}).closest('article')?.querySelector('img')).toHaveAttribute('src',items[0].avatarUrl);
});

it('reveals every avatar in a bulk response above the retained cache limit',async()=>{
 const api=fixture();const items=Array.from({length:65},(_,i)=>({...root,id:`bulk-${i}`,text:`Bulk ${i}`,replyCount:0,avatarUrl:`https://www.alive.org.tw/assets/bulk-new-${i}`}));
 api.comments.mockResolvedValue({items});
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={65} onChanged={()=>{}}/>);
 await screen.findByText('Bulk 64');
 expect(view.container.querySelectorAll('article img')).toHaveLength(65);
});
it('retries a mounted DOM image failure on explicit same-URL payload refresh',async()=>{
 const api=fixture();const url='https://www.alive.org.tw/assets/retry-same-url';
 api.comments.mockImplementation(async()=>({items:[{...root,avatarUrl:url}]}));
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={1} onChanged={()=>{}}/>);
 await screen.findByText('Root',{selector:'p'});
 const avatar=()=>view.container.querySelector('article img');
 fireEvent.error(avatar()!);expect(avatar()).toBeNull();
 const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now()+31_000);
 fireEvent.click(screen.getByRole('button',{name:'Refresh comments'}));
 await waitFor(()=>expect(avatar()).toHaveAttribute('src',url));
 clock.mockRestore();
});

it('keeps all changed avatar URLs when a mutation reconciles several loaded pages',async()=>{
 const api={...fixture(),updateComment:vi.fn().mockResolvedValue({})};let changed=false;
 const items=()=>Array.from({length:65},(_,i)=>({...root,mine:true,id:`reconcile-${i}`,text:`Reconcile ${i}`,replyCount:0,avatarUrl:`https://www.alive.org.tw/assets/reconcile-${changed?'new':'old'}-${i}`}));
 api.comments.mockImplementation(async(_id,options)=>({items:options.cursor?items().slice(40):items().slice(0,40),nextCursor:options.cursor?undefined:'second'}));
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={65} onChanged={()=>{}}/>);
 await screen.findByText('Reconcile 0',{selector:'p'});fireEvent.click(screen.getByRole('button',{name:'Load more'}));await screen.findByText('Reconcile 64');
 const first=screen.getByText('Reconcile 0',{selector:'p'}).closest('article')!;
 fireEvent.click(within(first).getByText('Edit'));
 changed=true;
 fireEvent.change(within(first).getByRole('textbox'),{target:{value:'edited'}});
 fireEvent.click(within(first).getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(first.querySelector('img')).toHaveAttribute('src','https://www.alive.org.tw/assets/reconcile-new-0'));
 expect(view.container.querySelectorAll('article img')).toHaveLength(65);
});

it.each([{...reply,threadParentId:'wrong-branch'},{...reply,id:'root'}])('rejects wrong-branch or cyclic children before rendering them: %j',async child=>{
 const api=fixture();api.comments.mockImplementation(async(_id,options)=>({items:options.parentId?[child]:[root]}));
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));await screen.findByRole('button',{name:'Retry'});
 expect(screen.queryByText('Reply text')).toBeNull();
});
it.each(['deleted','hidden'])('redacts stale identity, body and target for a %s intermediate node',async flag=>{
 const api=fixture();api.comments.mockResolvedValue({items:[{...root,[flag]:true,displayName:'Private name',text:'Private body',replyTo:{id:'target',displayName:'Private target'},avatarUrl:'https://www.alive.org.tw/assets/stale-avatar'}]});
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled onChanged={()=>{}}/>);
 await waitFor(()=>expect(view.container.querySelector('article')).not.toBeNull());
 expect(screen.queryByText(/Private/)).toBeNull();expect(view.container.querySelector('article img')).toBeNull();
 expect(screen.queryByRole('button',{name:'Like'})).toBeNull();expect(screen.getByRole('button',{name:'1 Replies'})).toBeInTheDocument();
});

it('ignores the active mobile sort choice and loads a changed choice',async()=>{
 mobile=true;const api=fixture();render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));await screen.findByText('Root',{selector:'p'});
 const count=api.comments.mock.calls.length;fireEvent.click(screen.getByRole('button',{name:'Top comments'}));
 expect(api.comments).toHaveBeenCalledTimes(count);expect(screen.getByRole('button',{name:'Refresh comments',hidden:true})).not.toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Newest first'}));
 await waitFor(()=>expect(api.comments).toHaveBeenLastCalledWith('r',expect.objectContaining({view:'threaded',order:'newest'})));
});
it('ignores a pending Top reconciliation after selecting Newest',async()=>{
 mobile=true;let resolveTop!:(page:{items:RecordingComment[];nextCursor?:string})=>void;
 const old={...root,text:'Old Top row'},newest={...root,id:'newest',text:'Newest row'};
 const api=fixture();api.comments.mockResolvedValueOnce({items:[old]}).mockImplementation(async(_id,options)=>options.order==='newest'?{items:[newest]}:new Promise(resolve=>{resolveTop=resolve;}));
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/1 Comments/}));await screen.findByText('Old Top row',{selector:'p'});
 fireEvent.change(screen.getByPlaceholderText('Add a comment'),{target:{value:'New post'}});fireEvent.click(screen.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(resolveTop).toBeTypeOf('function'));
 fireEvent.click(screen.getByRole('button',{name:'Newest first'}));
 await act(async()=>resolveTop({items:[old],nextCursor:'top-snapshot:20'}));
 await screen.findByText('Newest row',{selector:'p'});
 expect(screen.getByText('Newest row',{selector:'p'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Load more'})).toBeNull();
});
it('returns to below-player reading after the empty composer loses focus',async()=>{
 mobile=true;const api=fixture();const view=render(<div data-video-watch><video data-testid="player"/><VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/></div>);
 vi.spyOn(screen.getByTestId('player'),'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,390,200));
 fireEvent.click(screen.getByRole('button',{name:/1 Comments/}));await screen.findByText('Root',{selector:'p'});
 const dialog=view.container.querySelector('dialog')!;expect(dialog.style.top).toBe('200px');
 await act(async()=>screen.getByPlaceholderText('Add a comment').focus());expect(dialog.style.top).toBe('0px');
 await act(async()=>screen.getByRole('button',{name:'Like'}).focus());fireEvent(window,new Event('resize'));
 expect(dialog.style.top).toBe('200px');expect(screen.queryByRole('button',{name:'Comment'})).toBeNull();
});
it('loads a new reply branch once and serializes mutation reconciliation reads',async()=>{
 let active=0,maximum=0;const api=fixture();api.comments.mockImplementation(async(_id,options)=>{active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;return {items:options.parentId?[reply]:[root]};});
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled onChanged={()=>{}}/>);
 const article=(await screen.findByText('Root',{selector:'p'})).closest('article')!;fireEvent.click(within(article).getByRole('button',{name:'Reply'}));
 fireEvent.change(within(article).getByPlaceholderText('Reply'),{target:{value:'Answer'}});fireEvent.click(within(article.querySelector('form')!).getByRole('button',{name:'Reply'}));
 await screen.findByText('Reply text');await waitFor(()=>expect(api.comments.mock.calls.filter(([,options])=>options.parentId==='root')).toHaveLength(1));
 expect(maximum).toBe(1);
});
