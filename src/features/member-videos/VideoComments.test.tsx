import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act,within} from '@testing-library/react';
import {VideoComments} from './VideoComments';
import type {createMemberVideoApi} from './api';
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
const root={id:'root',displayName:'Alice',text:'Root',createdAt:'2026-10-17T00:00:00Z',replyCount:1,revision:1,deleted:false,mine:false};
const reply={...root,id:'reply',parentId:'root',displayName:'Bob',text:'Reply text',replyCount:0};
function fixture(){return {comments:vi.fn().mockImplementation(async(_id,options)=>({items:options.parentId?[reply]:[root]})),createComment:vi.fn().mockResolvedValue({}),setCommentReaction:vi.fn().mockResolvedValue({likes:1,reaction:'like'})};}
it('replies to a reply within the root thread and never fetches a nested thread',async()=>{
 const api=fixture();render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));await screen.findByText('Reply text');
 const item=screen.getByText('Reply text').closest('article')!;fireEvent.click(within(item).getByRole('button',{name:'Reply'}));
 fireEvent.change(screen.getByPlaceholderText('Reply'),{target:{value:'Answer'}});fireEvent.click(within(item).getByRole('button',{name:'Comment'}));
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
 await act(async()=>roots({items:[root]}));
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));
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
 const avatar=()=>view.container.querySelector('article > header')?.querySelector('img') ?? null;
 expect(avatar()).toHaveAttribute('src',first);
 fireEvent.click(screen.getByRole('button',{name:'1 Replies'}));await screen.findByText('Reply text');
 expect(view.container.querySelectorAll('article header img')).toHaveLength(2);
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
 expect(view.container.querySelector('article header img')).toHaveAttribute('src','https://www.alive.org.tw/assets/cold-avatar');
});

it('keeps mounted avatars when pagination exceeds the 64-image preparation cache',async()=>{
 const api=fixture();
 const items=Array.from({length:65},(_,i)=>({...root,id:`paged-${i}`,text:`Paged comment ${i}`,replyCount:0,avatarUrl:`https://www.alive.org.tw/assets/paged-avatar-${i}`}));
 api.comments.mockResolvedValueOnce({items:items.slice(0,40),nextCursor:'second'}).mockResolvedValueOnce({items:items.slice(40)});
 const view=render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" enabled count={65} onChanged={()=>{}}/>);
 await screen.findByText('Paged comment 0',{selector:'p'});
 expect(view.container.querySelectorAll('article header img')).toHaveLength(40);
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await screen.findByText('Paged comment 64');
 expect(view.container.querySelectorAll('article header img')).toHaveLength(65);
 expect(screen.getByText('Paged comment 0',{selector:'p'}).closest('article')?.querySelector('img')).toHaveAttribute('src',items[0].avatarUrl);
});
